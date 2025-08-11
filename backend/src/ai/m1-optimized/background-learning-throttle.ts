/**
 * 🎛️ Smart Background Learning Throttle
 * 
 * Intelligently manages background learning tasks based on system load
 * to maintain responsive gameplay on M1 Macs
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as os from 'os';
import { M1PerformanceOptimizer } from './m1-performance-optimizer';
import { MemoryPressureLevel } from './dynamic-memory-monitor';

export enum TaskPriority {
  CRITICAL = 0,    // Must run immediately (game moves)
  HIGH = 1,        // Important but deferrable (model updates)
  MEDIUM = 2,      // Background training
  LOW = 3          // Self-play, data collection
}

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  DEFERRED = 'deferred',
  CANCELLED = 'cancelled'
}

export interface BackgroundTask {
  id: string;
  type: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  deferCount: number;
  maxDefers: number;
  estimatedDuration: number; // milliseconds
  resourceRequirement: 'low' | 'medium' | 'high';
  execute: () => Promise<void>;
  onDefer?: () => void;
  onCancel?: () => void;
}

export interface SystemLoad {
  cpu: number;      // 0-1 percentage
  memory: number;   // 0-1 percentage
  timestamp: number;
}

@Injectable()
export class BackgroundLearningThrottle {
  private readonly logger = new Logger('BackgroundLearningThrottle');
  private taskQueue: Map<string, BackgroundTask> = new Map();
  private runningTasks: Set<string> = new Set();
  private deferredTasks: Map<string, BackgroundTask> = new Map();
  
  private systemLoadHistory: SystemLoad[] = [];
  private readonly loadHistorySize = 10;
  
  private monitorInterval: NodeJS.Timeout;
  private processingInterval: NodeJS.Timeout;
  
  // Thresholds
  private readonly loadThresholds = {
    resume: 0.70,    // Resume tasks when load < 70%
    defer: 0.80,     // Defer new tasks when load > 80%
    pause: 0.90      // Pause running tasks when load > 90%
  };
  
  // Task limits based on system state
  private maxConcurrentTasks = 2;
  private isPaused = false;
  
  // Worker scaling for M1 optimization
  private workerCount: number = 8; // M1 optimal default
  private readonly workerScalingConfig = {
    CRITICAL: 1,
    HIGH: 2,
    MODERATE: 4,
    NORMAL: 8
  };
  
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly config = M1PerformanceOptimizer.getOptimizationConfig()
  ) {
    // Adjust limits based on system
    if (config.isM1Architecture) {
      this.maxConcurrentTasks = config.totalMemoryGB >= 16 ? 2 : 1;
    } else {
      this.maxConcurrentTasks = config.totalMemoryGB >= 32 ? 4 : 2;
    }
    
    this.logger.log(`Background Learning Throttle initialized (max concurrent: ${this.maxConcurrentTasks})`);
    
    // Subscribe to memory events
    this.setupEventListeners();
  }
  
  /**
   * Start the throttle service
   */
  start(): void {
    // Monitor system load
    this.monitorInterval = setInterval(() => {
      this.updateSystemLoad();
    }, 5000); // Check every 5 seconds
    
    // Process task queue
    this.processingInterval = setInterval(() => {
      this.processTaskQueue();
    }, 2000); // Process every 2 seconds
    
    this.logger.log('Background learning throttle started');
  }
  
  /**
   * Stop the throttle service
   */
  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    // Cancel all pending tasks
    this.taskQueue.forEach(task => {
      task.status = TaskStatus.CANCELLED;
      task.onCancel?.();
    });
    
    this.taskQueue.clear();
    this.runningTasks.clear();
    this.deferredTasks.clear();
    
    this.logger.log('Background learning throttle stopped');
  }
  
  /**
   * Queue a background task
   */
  queueTask(task: Omit<BackgroundTask, 'id' | 'status' | 'createdAt' | 'deferCount'>): string {
    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullTask: BackgroundTask = {
      ...task,
      id,
      status: TaskStatus.PENDING,
      createdAt: Date.now(),
      deferCount: 0,
      maxDefers: task.maxDefers || 5
    };
    
    // Check if we should defer immediately based on current load
    const currentLoad = this.getCurrentLoad();
    if (currentLoad > this.loadThresholds.defer && task.priority > TaskPriority.HIGH) {
      fullTask.status = TaskStatus.DEFERRED;
      this.deferredTasks.set(id, fullTask);
      this.logger.log(`Task ${id} (${task.type}) deferred due to high system load`);
    } else {
      this.taskQueue.set(id, fullTask);
    }
    
    return id;
  }
  
  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    const task = this.taskQueue.get(taskId) || this.deferredTasks.get(taskId);
    
    if (task) {
      if (this.runningTasks.has(taskId)) {
        this.logger.warn(`Cannot cancel running task ${taskId}`);
        return false;
      }
      
      task.status = TaskStatus.CANCELLED;
      task.onCancel?.();
      
      this.taskQueue.delete(taskId);
      this.deferredTasks.delete(taskId);
      
      this.logger.log(`Task ${taskId} cancelled`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Update system load metrics
   */
  private updateSystemLoad(): void {
    const memStats = M1PerformanceOptimizer.getMemoryStats();
    const cpuUsage = os.loadavg()[0] / os.cpus().length; // 1-minute load average
    
    const load: SystemLoad = {
      cpu: Math.min(cpuUsage, 1),
      memory: memStats.usedMB / memStats.totalMB,
      timestamp: Date.now()
    };
    
    this.systemLoadHistory.push(load);
    
    // Keep history size limited
    if (this.systemLoadHistory.length > this.loadHistorySize) {
      this.systemLoadHistory.shift();
    }
    
    // Check if we need to take action based on load
    this.handleLoadChange(load);
  }
  
  /**
   * Get current system load
   */
  private getCurrentLoad(): number {
    if (this.systemLoadHistory.length === 0) {
      return 0.5; // Default medium load
    }
    
    const latest = this.systemLoadHistory[this.systemLoadHistory.length - 1];
    return Math.max(latest.cpu, latest.memory);
  }
  
  /**
   * Get average system load
   */
  private getAverageLoad(): number {
    if (this.systemLoadHistory.length === 0) {
      return 0.5;
    }
    
    const sum = this.systemLoadHistory.reduce((acc, load) => {
      return acc + Math.max(load.cpu, load.memory);
    }, 0);
    
    return sum / this.systemLoadHistory.length;
  }
  
  /**
   * Handle system load changes
   */
  private handleLoadChange(load: SystemLoad): void {
    const currentLoad = Math.max(load.cpu, load.memory);
    
    // Emergency pause at 90%+ load
    if (currentLoad > this.loadThresholds.pause && !this.isPaused) {
      this.pauseAllTasks();
    }
    
    // Resume if load drops below resume threshold
    else if (currentLoad < this.loadThresholds.resume && this.isPaused) {
      this.resumeTasks();
    }
    
    // Process deferred tasks if load is low
    if (currentLoad < this.loadThresholds.resume && this.deferredTasks.size > 0) {
      this.promoteDeferredTasks();
    }
  }
  
  /**
   * Process the task queue
   */
  private async processTaskQueue(): Promise<void> {
    if (this.isPaused) {
      return;
    }
    
    const currentLoad = this.getCurrentLoad();
    
    // Don't start new tasks if load is high
    if (currentLoad > this.loadThresholds.defer) {
      return;
    }
    
    // Check how many tasks we can run
    const availableSlots = this.maxConcurrentTasks - this.runningTasks.size;
    if (availableSlots <= 0) {
      return;
    }
    
    // Get next tasks to run (sorted by priority)
    const pendingTasks = Array.from(this.taskQueue.values())
      .filter(task => task.status === TaskStatus.PENDING)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, availableSlots);
    
    // Execute tasks
    for (const task of pendingTasks) {
      this.executeTask(task);
    }
  }
  
  /**
   * Execute a task
   */
  private async executeTask(task: BackgroundTask): Promise<void> {
    if (this.runningTasks.has(task.id)) {
      return;
    }
    
    task.status = TaskStatus.RUNNING;
    task.startedAt = Date.now();
    this.runningTasks.add(task.id);
    
    this.logger.log(`Executing task ${task.id} (${task.type})`);
    
    try {
      await task.execute();
      
      task.status = TaskStatus.COMPLETED;
      task.completedAt = Date.now();
      
      const duration = task.completedAt - task.startedAt;
      this.logger.log(`Task ${task.id} completed in ${duration}ms`);
      
      // Emit completion event
      this.eventEmitter.emit('background.task.completed', {
        taskId: task.id,
        type: task.type,
        duration
      });
      
    } catch (error) {
      this.logger.error(`Task ${task.id} failed:`, error);
      
      // Defer or cancel based on defer count
      if (task.deferCount < task.maxDefers) {
        task.deferCount++;
        task.status = TaskStatus.DEFERRED;
        task.onDefer?.();
        this.deferredTasks.set(task.id, task);
        this.logger.log(`Task ${task.id} deferred (attempt ${task.deferCount}/${task.maxDefers})`);
      } else {
        task.status = TaskStatus.CANCELLED;
        task.onCancel?.();
        this.logger.error(`Task ${task.id} cancelled after ${task.maxDefers} deferrals`);
      }
    } finally {
      this.runningTasks.delete(task.id);
      this.taskQueue.delete(task.id);
    }
  }
  
  /**
   * Scale workers based on memory pressure
   */
  private scaleWorkers(pressure: MemoryPressureLevel): void {
    const previousCount = this.workerCount;
    
    switch(pressure) {
      case MemoryPressureLevel.CRITICAL:
        this.workerCount = this.workerScalingConfig.CRITICAL;
        break;
      case MemoryPressureLevel.HIGH:
        this.workerCount = this.workerScalingConfig.HIGH;
        break;
      case MemoryPressureLevel.MODERATE:
        this.workerCount = this.workerScalingConfig.MODERATE;
        break;
      case MemoryPressureLevel.NORMAL:
      default:
        this.workerCount = this.workerScalingConfig.NORMAL;
        break;
    }
    
    // Adjust max concurrent tasks based on worker count
    this.maxConcurrentTasks = Math.min(this.workerCount, this.maxConcurrentTasks);
    
    if (previousCount !== this.workerCount) {
      this.logger.log(`🔧 Scaled workers from ${previousCount} to ${this.workerCount} (pressure: ${pressure})`);
      
      // Emit scaling event
      this.eventEmitter.emit('background.workers.scaled', {
        previousCount,
        newCount: this.workerCount,
        pressure,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get current worker count
   */
  getWorkerCount(): number {
    return this.workerCount;
  }

  /**
   * Pause all running tasks
   */
  private pauseAllTasks(): void {
    this.isPaused = true;
    this.logger.warn('🛑 Pausing all background tasks due to high system load');
    
    // Move pending tasks to deferred
    this.taskQueue.forEach((task, id) => {
      if (task.status === TaskStatus.PENDING) {
        task.status = TaskStatus.DEFERRED;
        task.onDefer?.();
        this.deferredTasks.set(id, task);
        this.taskQueue.delete(id);
      }
    });
    
    // Emit pause event
    this.eventEmitter.emit('background.learning.paused', {
      reason: 'high_system_load',
      timestamp: Date.now()
    });
  }
  
  /**
   * Resume task processing
   */
  private resumeTasks(): void {
    this.isPaused = false;
    this.logger.log('▶️ Resuming background task processing');
    
    // Emit resume event
    this.eventEmitter.emit('background.learning.resumed', {
      reason: 'system_load_normal',
      timestamp: Date.now()
    });
  }
  
  /**
   * Promote deferred tasks back to queue
   */
  private promoteDeferredTasks(): void {
    const currentLoad = this.getCurrentLoad();
    
    // Only promote if load is sufficiently low
    if (currentLoad >= this.loadThresholds.resume) {
      return;
    }
    
    // Sort deferred tasks by priority and defer count
    const deferredArray = Array.from(this.deferredTasks.values())
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.deferCount - b.deferCount;
      });
    
    // Promote up to half of deferred tasks
    const promoteCount = Math.ceil(deferredArray.length / 2);
    const toPromote = deferredArray.slice(0, promoteCount);
    
    for (const task of toPromote) {
      task.status = TaskStatus.PENDING;
      this.taskQueue.set(task.id, task);
      this.deferredTasks.delete(task.id);
      this.logger.log(`Promoted deferred task ${task.id} (${task.type})`);
    }
  }
  
  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for memory state changes with worker scaling
    this.eventEmitter.on('memory.state.changed', (state: { level: MemoryPressureLevel }) => {
      // Scale workers based on memory pressure
      this.scaleWorkers(state.level);
      
      switch(state.level) {
        case MemoryPressureLevel.CRITICAL:
          this.logger.error('Critical memory pressure - emergency pause');
          this.pauseAllTasks();
          break;
          
        case MemoryPressureLevel.HIGH:
          this.logger.warn('High memory pressure - pausing tasks');
          this.pauseAllTasks();
          break;
          
        case MemoryPressureLevel.MODERATE:
          // Just reduce workers, don't pause
          if (this.runningTasks.size > this.workerCount) {
            this.logger.warn(`Reducing active tasks to match worker count: ${this.workerCount}`);
          }
          break;
          
        case MemoryPressureLevel.NORMAL:
          if (this.isPaused) {
            this.logger.log('Memory pressure normalized, resuming tasks');
            this.resumeTasks();
          }
          break;
      }
    });
    
    // Legacy event support
    this.eventEmitter.on('memory.pressure.high', () => {
      this.scaleWorkers(MemoryPressureLevel.HIGH);
      this.pauseAllTasks();
    });
    
    this.eventEmitter.on('memory.pressure.moderate', () => {
      this.scaleWorkers(MemoryPressureLevel.MODERATE);
    });
  }
  
  /**
   * Get throttle statistics
   */
  getStatistics() {
    const currentLoad = this.getCurrentLoad();
    const avgLoad = this.getAverageLoad();
    
    return {
      queue: {
        pending: Array.from(this.taskQueue.values()).filter(t => t.status === TaskStatus.PENDING).length,
        running: this.runningTasks.size,
        deferred: this.deferredTasks.size,
        total: this.taskQueue.size + this.deferredTasks.size
      },
      system: {
        currentLoad: Math.round(currentLoad * 100),
        averageLoad: Math.round(avgLoad * 100),
        isPaused: this.isPaused,
        maxConcurrent: this.maxConcurrentTasks
      },
      tasks: {
        byPriority: this.getTasksByPriority(),
        byType: this.getTasksByType()
      }
    };
  }
  
  /**
   * Get tasks grouped by priority
   */
  private getTasksByPriority() {
    const allTasks = [...this.taskQueue.values(), ...this.deferredTasks.values()];
    const grouped = new Map<TaskPriority, number>();
    
    for (const priority of Object.values(TaskPriority)) {
      if (typeof priority === 'number') {
        grouped.set(priority, 0);
      }
    }
    
    allTasks.forEach(task => {
      grouped.set(task.priority, (grouped.get(task.priority) || 0) + 1);
    });
    
    return Object.fromEntries(grouped);
  }
  
  /**
   * Get tasks grouped by type
   */
  private getTasksByType() {
    const allTasks = [...this.taskQueue.values(), ...this.deferredTasks.values()];
    const grouped = new Map<string, number>();
    
    allTasks.forEach(task => {
      grouped.set(task.type, (grouped.get(task.type) || 0) + 1);
    });
    
    return Object.fromEntries(grouped);
  }
}

// Export factory function
export const createLearningThrottle = (eventEmitter: EventEmitter2) => {
  return new BackgroundLearningThrottle(eventEmitter);
};