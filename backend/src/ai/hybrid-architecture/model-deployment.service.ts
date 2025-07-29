/**
 * Model Deployment Service
 * Handles versioning, A/B testing, gradual rollout, and monitoring
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CellValue } from '../connect4AI';
import * as semver from 'semver';

// Try to load onnxruntime-node, but make it optional
let ort: any;
let InferenceSession: any;
try {
  ort = require('onnxruntime-node');
  InferenceSession = ort.InferenceSession;
} catch (error) {
  console.warn('⚠️ ONNX Runtime not available - ONNX model support disabled');
}

export interface ModelVersion {
  id: string;
  version: string;
  modelType: string;
  createdAt: Date;
  deployedAt?: Date;
  metrics: {
    trainingAccuracy: number;
    validationAccuracy: number;
    trainingLoss: number;
    validationLoss: number;
    inferenceSpeed?: number;
  };
  metadata: {
    gitCommit?: string;
    trainingDataVersion?: string;
    hyperparameters?: Record<string, any>;
    description?: string;
    tags?: string[];
  };
  files: {
    onnx: string;
    pytorch?: string;
    tensorflow?: string;
    config?: string;
  };
  status: 'trained' | 'validated' | 'staged' | 'deployed' | 'archived';
  deployment?: {
    strategy: 'immediate' | 'canary' | 'ab_test' | 'gradual';
    percentage?: number;
    targetGroups?: string[];
    performanceThresholds?: Record<string, number>;
  };
}

export interface DeploymentStrategy {
  type: 'immediate' | 'canary' | 'ab_test' | 'gradual';
  config: {
    initialPercentage?: number;
    incrementPercentage?: number;
    incrementInterval?: number; // minutes
    successCriteria?: {
      minAccuracy?: number;
      maxLatency?: number;
      minGamesPlayed?: number;
    };
    rollbackCriteria?: {
      errorRate?: number;
      latencyP99?: number;
      accuracyDrop?: number;
    };
  };
}

export interface ModelPerformance {
  modelId: string;
  timestamp: Date;
  metrics: {
    gamesPlayed: number;
    winRate: number;
    avgMoveAccuracy: number;
    avgInferenceTime: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    errorRate: number;
    memoryUsage: number;
  };
  feedback?: {
    userSatisfaction?: number;
    reportedIssues?: string[];
  };
}

export interface ABTestConfig {
  name: string;
  modelA: string;
  modelB: string;
  splitPercentage: number;
  duration: number; // hours
  metrics: string[];
  segmentation?: {
    userGroups?: string[];
    geoRegions?: string[];
    deviceTypes?: string[];
  };
}

@Injectable()
export class ModelDeploymentService {
  private readonly logger = new Logger(ModelDeploymentService.name);
  private readonly modelsDir = path.join(__dirname, 'models');
  private readonly deploymentsDir = path.join(__dirname, 'deployments');
  
  private modelRegistry: Map<string, ModelVersion> = new Map();
  private activeModels: Map<string, string> = new Map(); // group -> modelId
  private performanceHistory: Map<string, ModelPerformance[]> = new Map();
  private abTests: Map<string, ABTestConfig> = new Map();
  private deploymentQueue: string[] = [];
  
  constructor(private readonly eventEmitter: EventEmitter2) {
    this.initializeDirectories();
    this.loadRegistry();
  }

  /**
   * Register a new model version
   */
  async registerModel(
    modelPath: string,
    metadata: Partial<ModelVersion>
  ): Promise<ModelVersion> {
    const modelId = this.generateModelId();
    const version = this.generateVersion(metadata.modelType || 'unknown');
    
    // Copy model files
    const modelDir = path.join(this.modelsDir, modelId);
    await fs.mkdir(modelDir, { recursive: true });
    
    const onnxPath = path.join(modelDir, 'model.onnx');
    await fs.copyFile(modelPath, onnxPath);
    
    // Create version entry
    const modelVersion: ModelVersion = {
      id: modelId,
      version,
      modelType: metadata.modelType || 'unknown',
      createdAt: new Date(),
      metrics: metadata.metrics || {
        trainingAccuracy: 0,
        validationAccuracy: 0,
        trainingLoss: 0,
        validationLoss: 0,
      },
      metadata: {
        ...metadata.metadata,
        gitCommit: await this.getGitCommit(),
      },
      files: {
        onnx: onnxPath,
        ...metadata.files,
      },
      status: 'trained',
    };
    
    // Validate model
    await this.validateModel(modelVersion);
    
    // Add to registry
    this.modelRegistry.set(modelId, modelVersion);
    await this.saveRegistry();
    
    this.logger.log(`Registered model ${modelId} version ${version}`);
    
    // Emit event
    this.eventEmitter.emit('model.registered', {
      modelId,
      version,
      modelType: modelVersion.modelType,
    });
    
    return modelVersion;
  }

  /**
   * Deploy a model with strategy
   */
  async deployModel(
    modelId: string,
    strategy: DeploymentStrategy,
    targetGroup: string = 'default'
  ): Promise<void> {
    const model = this.modelRegistry.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    
    if (model.status !== 'validated' && model.status !== 'staged') {
      throw new Error(`Model ${modelId} is not ready for deployment`);
    }
    
    this.logger.log(`Deploying model ${modelId} with ${strategy.type} strategy`);
    
    model.deployment = {
      strategy: strategy.type,
      percentage: strategy.config.initialPercentage || 0,
      targetGroups: [targetGroup],
      performanceThresholds: strategy.config.successCriteria,
    };
    
    switch (strategy.type) {
      case 'immediate':
        await this.immediateDeployment(modelId, targetGroup);
        break;
        
      case 'canary':
        await this.canaryDeployment(modelId, strategy, targetGroup);
        break;
        
      case 'ab_test':
        await this.abTestDeployment(modelId, strategy, targetGroup);
        break;
        
      case 'gradual':
        await this.gradualDeployment(modelId, strategy, targetGroup);
        break;
    }
    
    model.deployedAt = new Date();
    model.status = 'deployed';
    await this.saveRegistry();
  }

  /**
   * Start A/B test between models
   */
  async startABTest(config: ABTestConfig): Promise<void> {
    this.logger.log(`Starting A/B test: ${config.name}`);
    
    // Validate models exist
    if (!this.modelRegistry.has(config.modelA) || !this.modelRegistry.has(config.modelB)) {
      throw new Error('One or both models not found');
    }
    
    // Store test config
    this.abTests.set(config.name, config);
    
    // Set up routing
    const testEndTime = new Date();
    testEndTime.setHours(testEndTime.getHours() + config.duration);
    
    // Schedule test end
    setTimeout(() => {
      this.endABTest(config.name);
    }, config.duration * 60 * 60 * 1000);
    
    // Emit event
    this.eventEmitter.emit('abtest.started', {
      testName: config.name,
      modelA: config.modelA,
      modelB: config.modelB,
      endTime: testEndTime,
    });
  }

  /**
   * Get model for inference based on deployment rules
   */
  async getModelForInference(
    context: {
      userId?: string;
      group?: string;
      region?: string;
      deviceType?: string;
    } = {}
  ): Promise<{ modelId: string; session: any }> {
    const group = context.group || 'default';
    
    // Check A/B tests first
    for (const [testName, test] of this.abTests) {
      if (this.shouldParticipateInABTest(context, test)) {
        const useModelB = Math.random() < test.splitPercentage / 100;
        const modelId = useModelB ? test.modelB : test.modelA;
        
        // Log participation
        this.logABTestParticipation(testName, modelId, context);
        
        const session = await this.loadModel(modelId);
        return { modelId, session };
      }
    }
    
    // Check gradual rollout
    const activeModelId = this.activeModels.get(group);
    if (activeModelId) {
      const model = this.modelRegistry.get(activeModelId);
      
      if (model?.deployment?.strategy === 'gradual') {
        // Check if user should get new model
        const rolloutPercentage = model.deployment.percentage || 0;
        const userHash = this.hashUser(context.userId || 'anonymous');
        const shouldGetNewModel = (userHash % 100) < rolloutPercentage;
        
        if (!shouldGetNewModel) {
          // Get previous model
          const previousModelId = this.getPreviousModel(group);
          if (previousModelId) {
            const session = await this.loadModel(previousModelId);
            return { modelId: previousModelId, session };
          }
        }
      }
    }
    
    // Default to active model for group
    const modelId = activeModelId || this.getDefaultModel();
    const session = await this.loadModel(modelId);
    
    return { modelId, session };
  }

  /**
   * Record model performance
   */
  async recordPerformance(
    modelId: string,
    performance: Omit<ModelPerformance, 'modelId' | 'timestamp'>
  ): Promise<void> {
    const perf: ModelPerformance = {
      modelId,
      timestamp: new Date(),
      ...performance,
    };
    
    // Store performance
    if (!this.performanceHistory.has(modelId)) {
      this.performanceHistory.set(modelId, []);
    }
    this.performanceHistory.get(modelId)!.push(perf);
    
    // Check rollback criteria
    const model = this.modelRegistry.get(modelId);
    if (model?.deployment?.strategy && model.deployment.performanceThresholds) {
      await this.checkRollbackCriteria(modelId, perf);
    }
    
    // Emit metrics
    this.eventEmitter.emit('model.performance', perf);
  }

  /**
   * Rollback a deployment
   */
  async rollbackDeployment(
    modelId: string,
    reason: string,
    targetGroup: string = 'default'
  ): Promise<void> {
    this.logger.warn(`Rolling back model ${modelId}: ${reason}`);
    
    const previousModelId = this.getPreviousModel(targetGroup);
    if (!previousModelId) {
      throw new Error('No previous model to rollback to');
    }
    
    // Switch back to previous model
    this.activeModels.set(targetGroup, previousModelId);
    
    // Update model status
    const model = this.modelRegistry.get(modelId);
    if (model) {
      model.status = 'archived';
      (model.metadata as any).rollbackReason = reason;
    }
    
    await this.saveRegistry();
    
    // Emit rollback event
    this.eventEmitter.emit('deployment.rollback', {
      modelId,
      previousModelId,
      reason,
      targetGroup,
    });
  }

  /**
   * Compare models performance
   */
  async compareModels(
    modelIds: string[],
    metrics: string[] = ['accuracy', 'latency', 'winRate']
  ): Promise<Record<string, any>> {
    const comparison: Record<string, any> = {};
    
    for (const modelId of modelIds) {
      const performances = this.performanceHistory.get(modelId) || [];
      
      if (performances.length === 0) {
        comparison[modelId] = { error: 'No performance data' };
        continue;
      }
      
      // Calculate aggregated metrics
      const aggregated: Record<string, number> = {};
      
      for (const metric of metrics) {
        const values = performances.map(p => {
          switch (metric) {
            case 'accuracy':
              return p.metrics.avgMoveAccuracy;
            case 'latency':
              return p.metrics.avgInferenceTime;
            case 'winRate':
              return p.metrics.winRate;
            default:
              return 0;
          }
        });
        
        (aggregated as any)[metric] = {
          mean: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          p50: this.percentile(values, 0.5),
          p95: this.percentile(values, 0.95),
        };
      }
      
      comparison[modelId] = {
        model: this.modelRegistry.get(modelId),
        metrics: aggregated,
        sampleSize: performances.length,
      };
    }
    
    return comparison;
  }

  /**
   * Scheduled deployment monitoring
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async monitorDeployments(): Promise<void> {
    for (const [modelId, model] of this.modelRegistry) {
      if (model.status !== 'deployed') continue;
      
      // Check gradual rollout progress
      if (model.deployment?.strategy === 'gradual') {
        await this.updateGradualRollout(modelId);
      }
      
      // Check performance thresholds
      const recentPerformance = this.getRecentPerformance(modelId, 5);
      if (recentPerformance.length > 0) {
        await this.checkPerformanceThresholds(modelId, recentPerformance);
      }
    }
  }

  /**
   * Archive old models
   */
  @Cron(CronExpression.EVERY_WEEK)
  async archiveOldModels(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days old
    
    for (const [modelId, model] of this.modelRegistry) {
      if (
        model.status === 'trained' &&
        model.createdAt < cutoffDate &&
        !this.isModelInUse(modelId)
      ) {
        this.logger.log(`Archiving old model ${modelId}`);
        
        // Move files to archive
        const archiveDir = path.join(this.modelsDir, 'archive');
        await fs.mkdir(archiveDir, { recursive: true });
        
        const modelDir = path.join(this.modelsDir, modelId);
        const archivePath = path.join(archiveDir, modelId);
        
        await fs.rename(modelDir, archivePath);
        
        // Update status
        model.status = 'archived';
        model.files.onnx = path.join(archivePath, 'model.onnx');
        
        await this.saveRegistry();
      }
    }
  }

  /**
   * Private helper methods
   */

  private async initializeDirectories(): Promise<void> {
    await fs.mkdir(this.modelsDir, { recursive: true });
    await fs.mkdir(this.deploymentsDir, { recursive: true });
  }

  private async loadRegistry(): Promise<void> {
    const registryPath = path.join(this.deploymentsDir, 'registry.json');
    
    try {
      const data = await fs.readFile(registryPath, 'utf-8');
      const registry = JSON.parse(data);
      
      // Load models
      for (const [id, model] of Object.entries(registry.models || {})) {
        this.modelRegistry.set(id, model as ModelVersion);
      }
      
      // Load active models
      for (const [group, modelId] of Object.entries(registry.activeModels || {})) {
        this.activeModels.set(group, modelId as string);
      }
      
      this.logger.log(`Loaded ${this.modelRegistry.size} models from registry`);
    } catch (error) {
      this.logger.log('No existing registry found');
    }
  }

  private async saveRegistry(): Promise<void> {
    const registry = {
      models: Object.fromEntries(this.modelRegistry),
      activeModels: Object.fromEntries(this.activeModels),
      lastUpdated: new Date(),
    };
    
    const registryPath = path.join(this.deploymentsDir, 'registry.json');
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));
  }

  private generateModelId(): string {
    return `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateVersion(modelType: string): string {
    // Find latest version of this type
    let latestVersion = '0.0.0';
    
    for (const model of this.modelRegistry.values()) {
      if (model.modelType === modelType && semver.gt(model.version, latestVersion)) {
        latestVersion = model.version;
      }
    }
    
    // Increment patch version
    return semver.inc(latestVersion, 'patch') || '0.0.1';
  }

  private async getGitCommit(): Promise<string> {
    try {
      const { execSync } = require('child_process');
      return execSync('git rev-parse HEAD').toString().trim();
    } catch {
      return 'unknown';
    }
  }

  private async validateModel(model: ModelVersion): Promise<void> {
    try {
      // Load model to validate
      if (!InferenceSession) {
        throw new Error('ONNX Runtime not available');
      }
      const session = await InferenceSession.create(model.files.onnx);
      
      // Run test inference
      const testInput = new Float32Array(1 * 3 * 6 * 7).fill(0);
      const feeds = { input: new (require('onnxruntime-node').Tensor)('float32', testInput, [1, 3, 6, 7]) };
      
      const results = await session.run(feeds);
      
      // Validate outputs
      if (!results.policy || !results.value) {
        throw new Error('Model missing required outputs');
      }
      
      model.status = 'validated';
      
      // Record inference speed
      const start = performance.now();
      await session.run(feeds);
      const inferenceTime = performance.now() - start;
      
      model.metrics.inferenceSpeed = inferenceTime;
      
      // await session.dispose(); // dispose() may not be available in all versions
    } catch (error) {
      this.logger.error(`Model validation failed: ${error.message}`);
      throw error;
    }
  }

  private async immediateDeployment(
    modelId: string,
    targetGroup: string
  ): Promise<void> {
    this.activeModels.set(targetGroup, modelId);
    
    this.logger.log(`Immediately deployed model ${modelId} to ${targetGroup}`);
    
    this.eventEmitter.emit('deployment.complete', {
      modelId,
      targetGroup,
      strategy: 'immediate',
    });
  }

  private async canaryDeployment(
    modelId: string,
    strategy: DeploymentStrategy,
    targetGroup: string
  ): Promise<void> {
    const model = this.modelRegistry.get(modelId)!;
    
    // Start with small percentage
    model.deployment!.percentage = strategy.config.initialPercentage || 5;
    
    // Monitor and gradually increase
    const interval = setInterval(async () => {
      const performance = this.getRecentPerformance(modelId, 10);
      
      if (this.meetsSuccessCriteria(performance, strategy.config.successCriteria)) {
        model.deployment!.percentage! += strategy.config.incrementPercentage || 10;
        
        if (model.deployment!.percentage! >= 100) {
          // Complete deployment
          this.activeModels.set(targetGroup, modelId);
          clearInterval(interval);
          
          this.eventEmitter.emit('deployment.complete', {
            modelId,
            targetGroup,
            strategy: 'canary',
          });
        }
      }
    }, (strategy.config.incrementInterval || 30) * 60 * 1000);
  }

  private async abTestDeployment(
    modelId: string,
    strategy: DeploymentStrategy,
    targetGroup: string
  ): Promise<void> {
    // A/B test is handled through getModelForInference
    // This just marks the model as ready for A/B testing
    const model = this.modelRegistry.get(modelId)!;
    model.deployment!.percentage = 50; // Default 50/50 split
  }

  private async gradualDeployment(
    modelId: string,
    strategy: DeploymentStrategy,
    targetGroup: string
  ): Promise<void> {
    const model = this.modelRegistry.get(modelId)!;
    
    // Start deployment
    model.deployment!.percentage = strategy.config.initialPercentage || 10;
    
    // Gradual increase handled by scheduled monitor
  }

  private async updateGradualRollout(modelId: string): Promise<void> {
    const model = this.modelRegistry.get(modelId)!;
    const performance = this.getRecentPerformance(modelId, 10);
    
    if (
      model.deployment!.percentage! < 100 &&
      this.meetsSuccessCriteria(performance, model.deployment!.performanceThresholds)
    ) {
      // Increase rollout
      model.deployment!.percentage! = Math.min(
        100,
        model.deployment!.percentage! + 10
      );
      
      this.logger.log(`Increased rollout for ${modelId} to ${model.deployment!.percentage}%`);
      
      if (model.deployment!.percentage === 100) {
        this.eventEmitter.emit('deployment.complete', {
          modelId,
          strategy: 'gradual',
        });
      }
    }
  }

  private async checkRollbackCriteria(
    modelId: string,
    performance: ModelPerformance
  ): Promise<void> {
    const model = this.modelRegistry.get(modelId)!;
    const criteria = model.deployment?.performanceThresholds;
    
    if (!criteria) return;
    
    const reasons: string[] = [];
    
    if (criteria.minAccuracy && performance.metrics.avgMoveAccuracy < criteria.minAccuracy) {
      reasons.push(`Accuracy ${performance.metrics.avgMoveAccuracy} < ${criteria.minAccuracy}`);
    }
    
    if (criteria.maxLatency && performance.metrics.p99Latency > criteria.maxLatency) {
      reasons.push(`P99 latency ${performance.metrics.p99Latency} > ${criteria.maxLatency}`);
    }
    
    if (reasons.length > 0) {
      await this.rollbackDeployment(modelId, reasons.join(', '));
    }
  }

  private async checkPerformanceThresholds(
    modelId: string,
    performances: ModelPerformance[]
  ): Promise<void> {
    const avgMetrics = this.calculateAverageMetrics(performances);
    
    // Emit performance summary
    this.eventEmitter.emit('model.performance.summary', {
      modelId,
      avgMetrics,
      sampleSize: performances.length,
    });
  }

  private shouldParticipateInABTest(
    context: any,
    test: ABTestConfig
  ): boolean {
    // Check segmentation criteria
    if (test.segmentation) {
      if (test.segmentation.userGroups && context.group) {
        if (!test.segmentation.userGroups.includes(context.group)) {
          return false;
        }
      }
      // Add more segmentation checks as needed
    }
    
    return true;
  }

  private logABTestParticipation(
    testName: string,
    modelId: string,
    context: any
  ): void {
    // Log participation for analysis
    this.eventEmitter.emit('abtest.participation', {
      testName,
      modelId,
      userId: context.userId,
      timestamp: new Date(),
    });
  }

  private async loadModel(modelId: string): Promise<any> {
    const model = this.modelRegistry.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    
    if (!InferenceSession) {
      throw new Error('ONNX Runtime not available');
    }
    return await InferenceSession.create(model.files.onnx);
  }

  private getPreviousModel(group: string): string | null {
    // Find the previously active model
    const currentModelId = this.activeModels.get(group);
    
    // Get all deployed models sorted by deployment date
    const deployedModels = Array.from(this.modelRegistry.entries())
      .filter(([_, model]) => model.deployedAt && model.status === 'deployed')
      .sort((a, b) => b[1].deployedAt!.getTime() - a[1].deployedAt!.getTime());
    
    // Find the one before current
    const currentIndex = deployedModels.findIndex(([id, _]) => id === currentModelId);
    
    if (currentIndex > 0) {
      return deployedModels[currentIndex + 1][0];
    }
    
    return null;
  }

  private getDefaultModel(): string {
    // Get the latest validated model
    const validatedModels = Array.from(this.modelRegistry.entries())
      .filter(([_, model]) => model.status === 'validated' || model.status === 'deployed')
      .sort((a, b) => b[1].createdAt.getTime() - a[1].createdAt.getTime());
    
    if (validatedModels.length > 0) {
      return validatedModels[0][0];
    }
    
    throw new Error('No validated models available');
  }

  private hashUser(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private isModelInUse(modelId: string): boolean {
    // Check if model is active
    for (const activeId of this.activeModels.values()) {
      if (activeId === modelId) return true;
    }
    
    // Check if in A/B test
    for (const test of this.abTests.values()) {
      if (test.modelA === modelId || test.modelB === modelId) {
        return true;
      }
    }
    
    return false;
  }

  private getRecentPerformance(
    modelId: string,
    minutes: number
  ): ModelPerformance[] {
    const performances = this.performanceHistory.get(modelId) || [];
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - minutes);
    
    return performances.filter(p => p.timestamp > cutoff);
  }

  private meetsSuccessCriteria(
    performances: ModelPerformance[],
    criteria?: any
  ): boolean {
    if (!criteria || performances.length === 0) return true;
    
    const avgMetrics = this.calculateAverageMetrics(performances);
    
    if (criteria.minAccuracy && avgMetrics.accuracy < criteria.minAccuracy) {
      return false;
    }
    
    if (criteria.maxLatency && avgMetrics.latency > criteria.maxLatency) {
      return false;
    }
    
    if (criteria.minGamesPlayed && avgMetrics.totalGames < criteria.minGamesPlayed) {
      return false;
    }
    
    return true;
  }

  private calculateAverageMetrics(performances: ModelPerformance[]): any {
    const sum = performances.reduce(
      (acc, p) => ({
        accuracy: acc.accuracy + p.metrics.avgMoveAccuracy,
        latency: acc.latency + p.metrics.avgInferenceTime,
        winRate: acc.winRate + p.metrics.winRate,
        totalGames: acc.totalGames + p.metrics.gamesPlayed,
      }),
      { accuracy: 0, latency: 0, winRate: 0, totalGames: 0 }
    );
    
    const count = performances.length;
    
    return {
      accuracy: sum.accuracy / count,
      latency: sum.latency / count,
      winRate: sum.winRate / count,
      totalGames: sum.totalGames,
    };
  }

  private percentile(values: number[], p: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }

  private async endABTest(testName: string): Promise<void> {
    const test = this.abTests.get(testName);
    if (!test) return;
    
    // Analyze results
    const results = await this.analyzeABTestResults(test);
    
    // Determine winner
    const winner = results.modelAMetrics.accuracy > results.modelBMetrics.accuracy
      ? test.modelA
      : test.modelB;
    
    this.logger.log(`A/B test ${testName} complete. Winner: ${winner}`);
    
    // Remove test
    this.abTests.delete(testName);
    
    // Emit results
    this.eventEmitter.emit('abtest.complete', {
      testName,
      winner,
      results,
    });
  }

  private async analyzeABTestResults(test: ABTestConfig): Promise<any> {
    // Analyze performance of both models
    const modelAPerf = this.performanceHistory.get(test.modelA) || [];
    const modelBPerf = this.performanceHistory.get(test.modelB) || [];
    
    return {
      modelAMetrics: this.calculateAverageMetrics(modelAPerf),
      modelBMetrics: this.calculateAverageMetrics(modelBPerf),
      sampleSizeA: modelAPerf.length,
      sampleSizeB: modelBPerf.length,
    };
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(): Promise<any> {
    return {
      totalModels: this.modelRegistry.size,
      activeModels: Object.fromEntries(this.activeModels),
      deployedModels: Array.from(this.modelRegistry.values())
        .filter(m => m.status === 'deployed')
        .map(m => ({ id: m.id, version: m.version, deployedAt: m.deployedAt })),
      activeABTests: Array.from(this.abTests.keys()),
    };
  }
}