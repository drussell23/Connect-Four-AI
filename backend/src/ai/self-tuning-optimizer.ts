import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdaptiveResourceManager } from './adaptive-resource-manager';
import { AIPerformanceCollector } from './ai-performance-collector';
import { ResourceMonitorService } from './resource-monitor.service';

export interface OptimizationTarget {
  metric: 'response_time' | 'resource_usage' | 'success_rate' | 'efficiency';
  target: number;
  weight: number;
}

export interface OptimizationState {
  currentObjective: string;
  targets: OptimizationTarget[];
  performanceScore: number;
  lastOptimization: Date;
  optimizationCount: number;
  improvements: number;
}

export interface TuningDecision {
  parameter: string;
  currentValue: any;
  newValue: any;
  expectedImprovement: number;
  confidence: number;
}

@Injectable()
export class SelfTuningOptimizer {
  private readonly logger = new Logger(SelfTuningOptimizer.name);
  
  // Optimization state
  private optimizationState: OptimizationState = {
    currentObjective: 'balanced',
    targets: [
      { metric: 'response_time', target: 2000, weight: 0.3 },
      { metric: 'resource_usage', target: 0.7, weight: 0.3 },
      { metric: 'success_rate', target: 0.95, weight: 0.3 },
      { metric: 'efficiency', target: 0.8, weight: 0.1 }
    ],
    performanceScore: 0.5,
    lastOptimization: new Date(),
    optimizationCount: 0,
    improvements: 0
  };
  
  // Tunable parameters and their ranges
  private tunableParameters = {
    cacheSize: { min: 1000, max: 50000, current: 10000, step: 1000 },
    batchSize: { min: 1, max: 64, current: 16, step: 4 },
    workerThreads: { min: 1, max: 8, current: 4, step: 1 },
    thinkingTimeMultiplier: { min: 0.5, max: 2.0, current: 1.0, step: 0.1 },
    precomputationDepth: { min: 1, max: 5, current: 3, step: 1 },
    learningRate: { min: 0.0001, max: 0.01, current: 0.001, step: 0.0001 }
  };
  
  // Performance history for decision making
  private performanceHistory: Array<{
    timestamp: number;
    parameters: any;
    score: number;
  }> = [];
  
  private readonly historySize = 100;
  private optimizationEnabled = true;

  constructor(
    private readonly adaptiveResourceManager: AdaptiveResourceManager,
    private readonly performanceCollector: AIPerformanceCollector,
    private readonly resourceMonitor: ResourceMonitorService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.initialize();
  }

  /**
   * Initialize the self-tuning optimizer
   */
  private initialize(): void {
    this.logger.log('🔧 Initializing Self-Tuning Optimizer...');
    
    // Load saved parameters if available
    this.loadSavedParameters();
    
    // Subscribe to events
    this.subscribeToEvents();
    
    this.logger.log('✅ Self-Tuning Optimizer initialized');
  }

  /**
   * Main optimization loop - runs periodically
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async performOptimization(): Promise<void> {
    if (!this.optimizationEnabled) {
      return;
    }
    
    this.logger.log('🔄 Starting optimization cycle...');
    
    try {
      // Collect current performance metrics
      const currentPerformance = await this.evaluateCurrentPerformance();
      
      // Record current state
      this.recordPerformanceHistory(currentPerformance);
      
      // Check if optimization is needed
      if (!this.shouldOptimize(currentPerformance)) {
        this.logger.log('✅ Performance is within targets, no optimization needed');
        return;
      }
      
      // Generate tuning decisions
      const decisions = this.generateTuningDecisions(currentPerformance);
      
      if (decisions.length === 0) {
        this.logger.log('ℹ️ No beneficial tuning decisions found');
        return;
      }
      
      // Apply the best decision
      const bestDecision = decisions[0];
      await this.applyTuningDecision(bestDecision);
      
      // Update state
      this.optimizationState.lastOptimization = new Date();
      this.optimizationState.optimizationCount++;
      
      // Emit optimization event
      this.eventEmitter.emit('optimizer.tuning.applied', {
        decision: bestDecision,
        newScore: currentPerformance,
        timestamp: Date.now()
      });
      
      this.logger.log(`✅ Applied tuning: ${bestDecision.parameter} = ${bestDecision.newValue}`);
      
    } catch (error) {
      this.logger.error('Optimization cycle failed:', error);
    }
  }

  /**
   * Evaluate current system performance
   */
  private async evaluateCurrentPerformance(): Promise<number> {
    // Get performance report
    const report = this.performanceCollector.generateReport(1); // Last hour
    const currentLoad = this.performanceCollector.getCurrentLoad();
    const resourceStatus = this.resourceMonitor.getResourceSummary();
    
    // Calculate scores for each target
    const scores: Record<string, number> = {};
    
    // Response time score (lower is better)
    const responseTimeTarget = this.getTarget('response_time');
    scores.response_time = Math.max(0, 1 - (report.averageResponseTime / responseTimeTarget.target));
    
    // Resource usage score (lower is better)
    const resourceTarget = this.getTarget('resource_usage');
    const avgResourceUsage = (parseFloat(resourceStatus.cpuUsage) + parseFloat(resourceStatus.memoryUsage)) / 200;
    scores.resource_usage = Math.max(0, 1 - (avgResourceUsage / resourceTarget.target));
    
    // Success rate score (higher is better)
    const successTarget = this.getTarget('success_rate');
    const overallSuccessRate = this.calculateOverallSuccessRate(report);
    scores.success_rate = Math.min(1, overallSuccessRate / successTarget.target);
    
    // Efficiency score
    const efficiencyTarget = this.getTarget('efficiency');
    scores.efficiency = Math.min(1, report.resourceEfficiency / efficiencyTarget.target);
    
    // Calculate weighted score
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const target of this.optimizationState.targets) {
      const score = scores[target.metric] || 0;
      totalScore += score * target.weight;
      totalWeight += target.weight;
    }
    
    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    this.optimizationState.performanceScore = finalScore;
    
    return finalScore;
  }

  /**
   * Calculate overall success rate from report
   */
  private calculateOverallSuccessRate(report: any): number {
    const strategies = Object.values(report.strategyBreakdown) as any[];
    if (strategies.length === 0) return 0;
    
    const totalMoves = strategies.reduce((sum, s) => sum + s.totalMoves, 0);
    const totalSuccess = strategies.reduce((sum, s) => sum + s.successRate * s.totalMoves, 0);
    
    return totalMoves > 0 ? totalSuccess / totalMoves : 0;
  }

  /**
   * Check if optimization should be performed
   */
  private shouldOptimize(currentScore: number): boolean {
    // Don't optimize too frequently
    const timeSinceLastOpt = Date.now() - this.optimizationState.lastOptimization.getTime();
    if (timeSinceLastOpt < 5 * 60 * 1000) { // 5 minutes
      return false;
    }
    
    // Optimize if score is below threshold
    if (currentScore < 0.8) {
      return true;
    }
    
    // Optimize if performance is degrading
    if (this.isPerformanceDegrading()) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if performance is degrading
   */
  private isPerformanceDegrading(): boolean {
    if (this.performanceHistory.length < 3) {
      return false;
    }
    
    // Check last 3 measurements
    const recent = this.performanceHistory.slice(-3);
    const scores = recent.map(h => h.score);
    
    // Performance is degrading if each score is lower than the previous
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] >= scores[i - 1]) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Generate tuning decisions based on current performance
   */
  private generateTuningDecisions(currentScore: number): TuningDecision[] {
    const decisions: TuningDecision[] = [];
    
    // Analyze which metrics need improvement
    const report = this.performanceCollector.generateReport(1);
    const resourceStatus = this.resourceMonitor.getResourceSummary();
    
    // Response time optimization
    if (report.averageResponseTime > 3000) {
      // Reduce thinking time multiplier
      if (this.tunableParameters.thinkingTimeMultiplier.current > this.tunableParameters.thinkingTimeMultiplier.min) {
        decisions.push({
          parameter: 'thinkingTimeMultiplier',
          currentValue: this.tunableParameters.thinkingTimeMultiplier.current,
          newValue: Math.max(
            this.tunableParameters.thinkingTimeMultiplier.min,
            this.tunableParameters.thinkingTimeMultiplier.current - this.tunableParameters.thinkingTimeMultiplier.step
          ),
          expectedImprovement: 0.1,
          confidence: 0.8
        });
      }
      
      // Reduce precomputation depth
      if (this.tunableParameters.precomputationDepth.current > this.tunableParameters.precomputationDepth.min) {
        decisions.push({
          parameter: 'precomputationDepth',
          currentValue: this.tunableParameters.precomputationDepth.current,
          newValue: this.tunableParameters.precomputationDepth.current - this.tunableParameters.precomputationDepth.step,
          expectedImprovement: 0.05,
          confidence: 0.7
        });
      }
    }
    
    // Resource usage optimization
    const resourceUsage = (parseFloat(resourceStatus.cpuUsage) + parseFloat(resourceStatus.memoryUsage)) / 200;
    if (resourceUsage > 0.8) {
      // Reduce batch size
      if (this.tunableParameters.batchSize.current > this.tunableParameters.batchSize.min) {
        decisions.push({
          parameter: 'batchSize',
          currentValue: this.tunableParameters.batchSize.current,
          newValue: Math.max(
            this.tunableParameters.batchSize.min,
            this.tunableParameters.batchSize.current - this.tunableParameters.batchSize.step
          ),
          expectedImprovement: 0.15,
          confidence: 0.85
        });
      }
      
      // Reduce worker threads
      if (this.tunableParameters.workerThreads.current > this.tunableParameters.workerThreads.min) {
        decisions.push({
          parameter: 'workerThreads',
          currentValue: this.tunableParameters.workerThreads.current,
          newValue: this.tunableParameters.workerThreads.current - this.tunableParameters.workerThreads.step,
          expectedImprovement: 0.1,
          confidence: 0.75
        });
      }
    }
    
    // Success rate optimization
    const learningMetrics = this.adaptiveResourceManager.getLearningMetrics();
    if (learningMetrics.adaptationAccuracy < 0.9) {
      // Increase learning rate slightly
      if (this.tunableParameters.learningRate.current < this.tunableParameters.learningRate.max) {
        decisions.push({
          parameter: 'learningRate',
          currentValue: this.tunableParameters.learningRate.current,
          newValue: Math.min(
            this.tunableParameters.learningRate.max,
            this.tunableParameters.learningRate.current + this.tunableParameters.learningRate.step
          ),
          expectedImprovement: 0.08,
          confidence: 0.6
        });
      }
    }
    
    // Cache optimization
    if (report.resourceEfficiency < 0.7) {
      // Increase cache size
      if (this.tunableParameters.cacheSize.current < this.tunableParameters.cacheSize.max) {
        decisions.push({
          parameter: 'cacheSize',
          currentValue: this.tunableParameters.cacheSize.current,
          newValue: Math.min(
            this.tunableParameters.cacheSize.max,
            this.tunableParameters.cacheSize.current + this.tunableParameters.cacheSize.step * 2
          ),
          expectedImprovement: 0.12,
          confidence: 0.9
        });
      }
    }
    
    // Sort by expected improvement
    decisions.sort((a, b) => b.expectedImprovement - a.expectedImprovement);
    
    return decisions;
  }

  /**
   * Apply a tuning decision
   */
  private async applyTuningDecision(decision: TuningDecision): Promise<void> {
    // Update parameter
    this.tunableParameters[decision.parameter].current = decision.newValue;
    
    // Apply to relevant systems
    switch (decision.parameter) {
      case 'cacheSize':
        this.eventEmitter.emit('optimizer.cache.resize', { newSize: decision.newValue });
        break;
        
      case 'workerThreads':
        this.eventEmitter.emit('optimizer.workers.adjust', { count: decision.newValue });
        break;
        
      case 'learningRate':
        this.eventEmitter.emit('optimizer.learning.adjust', { rate: decision.newValue });
        break;
        
      case 'thinkingTimeMultiplier':
        this.eventEmitter.emit('optimizer.thinking.adjust', { multiplier: decision.newValue });
        break;
        
      case 'precomputationDepth':
        this.eventEmitter.emit('optimizer.precompute.adjust', { depth: decision.newValue });
        break;
        
      case 'batchSize':
        this.eventEmitter.emit('optimizer.batch.adjust', { size: decision.newValue });
        break;
    }
    
    // Save parameters
    await this.saveParameters();
  }

  /**
   * Record performance history
   */
  private recordPerformanceHistory(score: number): void {
    this.performanceHistory.push({
      timestamp: Date.now(),
      parameters: JSON.parse(JSON.stringify(this.tunableParameters)),
      score
    });
    
    // Maintain history size
    if (this.performanceHistory.length > this.historySize) {
      this.performanceHistory.shift();
    }
    
    // Check for improvement
    if (this.performanceHistory.length > 1) {
      const previousScore = this.performanceHistory[this.performanceHistory.length - 2].score;
      if (score > previousScore) {
        this.optimizationState.improvements++;
      }
    }
  }

  /**
   * Get optimization target by metric
   */
  private getTarget(metric: string): OptimizationTarget {
    return this.optimizationState.targets.find(t => t.metric === metric) || 
           { metric: metric as any, target: 1, weight: 0.25 };
  }

  /**
   * Subscribe to system events
   */
  private subscribeToEvents(): void {
    // React to system overload
    this.eventEmitter.on('system.overload', () => {
      this.logger.warn('System overload detected, triggering emergency optimization');
      this.performOptimization();
    });
    
    // React to performance alerts
    this.eventEmitter.on('performance.degraded', () => {
      this.optimizationEnabled = true;
    });
  }

  /**
   * Save current parameters
   */
  private async saveParameters(): Promise<void> {
    // In a real implementation, save to database or file
    this.logger.debug('Parameters saved');
  }

  /**
   * Load saved parameters
   */
  private loadSavedParameters(): void {
    // In a real implementation, load from database or file
    this.logger.debug('Parameters loaded');
  }

  /**
   * Get current optimization state
   */
  getOptimizationState(): OptimizationState {
    return { ...this.optimizationState };
  }

  /**
   * Get current parameters
   */
  getCurrentParameters() {
    return JSON.parse(JSON.stringify(this.tunableParameters));
  }

  /**
   * Enable or disable optimization
   */
  setOptimizationEnabled(enabled: boolean): void {
    this.optimizationEnabled = enabled;
    this.logger.log(`Optimization ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Manual parameter override
   */
  overrideParameter(parameter: string, value: number): void {
    if (this.tunableParameters[parameter]) {
      this.tunableParameters[parameter].current = value;
      this.logger.log(`Parameter ${parameter} manually set to ${value}`);
    }
  }
}