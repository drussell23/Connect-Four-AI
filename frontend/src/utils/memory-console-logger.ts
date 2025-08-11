/**
 * Memory Console Logger
 * Displays memory dashboard metrics in the browser console with beautiful formatting
 */

export interface MemoryMetrics {
  timestamp: number;
  system?: {
    platform: string;
    architecture: string;
    totalMemoryGB: number;
    cpuCores: number;
    isM1: boolean;
  };
  memory?: {
    heap: {
      usedMB: number;
      totalMB: number;
      percentage: number;
    };
    system: {
      usedMB: number;
      freeMB: number;
      percentage: number;
    };
    pressure: string;
  };
  tensorflow?: {
    backend: string;
    numTensors: number;
    numBytes: number;
    numBytesInGPU: number;
    modelCount: number;
  };
  caches?: {
    total: {
      entries: number;
      memoryMB: number;
      hitRate: number;
    };
  };
  ai?: {
    currentMode: string;
    offloadEnabled: boolean;
    lightweightActive: boolean;
    defensiveMode: boolean;
    inferenceDevice: string;
    avgInferenceTime: number;
  };
  background?: {
    tasksQueued: number;
    tasksRunning: number;
    tasksDeferred: number;
    isPaused: boolean;
    selfPlayActive: boolean;
    trainingActive: boolean;
  };
  degradation?: {
    level: number;
    rateLimits: {
      requestsPerSecond: number;
      currentDelay: number;
    };
    activeClients: number;
    blockedClients: number;
  };
}

export class MemoryConsoleLogger {
  private static instance: MemoryConsoleLogger;
  private metricsHistory: MemoryMetrics[] = [];
  private maxHistorySize = 100;
  private isEnabled = true;

  private constructor() {}

  static getInstance(): MemoryConsoleLogger {
    if (!MemoryConsoleLogger.instance) {
      MemoryConsoleLogger.instance = new MemoryConsoleLogger();
    }
    return MemoryConsoleLogger.instance;
  }

  enable() {
    this.isEnabled = true;
    console.log('%c📊 Memory Console Logger Enabled', 'color: #4CAF50; font-weight: bold');
  }

  disable() {
    this.isEnabled = false;
    console.log('%c📊 Memory Console Logger Disabled', 'color: #f44336; font-weight: bold');
  }

  logMetrics(metrics: MemoryMetrics) {
    if (!this.isEnabled) return;

    // Add to history
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    // Format timestamp
    const timestamp = new Date(metrics.timestamp).toLocaleTimeString();

    // Console group for organized display
    console.groupCollapsed(
      `%c[${timestamp}] 📊 Memory Dashboard Update`,
      'color: #2196F3; font-weight: bold'
    );

    // System Information
    if (metrics.system) {
      console.log(
        '%c⚙️ System',
        'color: #607D8B; font-weight: bold; font-size: 12px'
      );
      console.log(`   Platform: ${metrics.system.platform} (${metrics.system.architecture})`);
      console.log(`   Total Memory: ${metrics.system.totalMemoryGB.toFixed(2)} GB`);
      console.log(`   CPU Cores: ${metrics.system.cpuCores}`);
      console.log(`   M1 Mac: ${metrics.system.isM1 ? 'Yes' : 'No'}`);
    }

    // Memory Information
    if (metrics.memory) {
      console.log(
        '%c💾 Memory Usage',
        'color: #FF9800; font-weight: bold; font-size: 12px'
      );
      console.log(`   Heap: ${metrics.memory.heap.usedMB.toFixed(0)} MB / ${metrics.memory.heap.totalMB.toFixed(0)} MB (${metrics.memory.heap.percentage.toFixed(1)}%)`);
      console.log(`   System: ${metrics.memory.system.usedMB.toFixed(0)} MB used, ${metrics.memory.system.freeMB.toFixed(0)} MB free (${metrics.memory.system.percentage.toFixed(1)}%)`);
      console.log(`   Pressure: ${this.formatPressure(metrics.memory.pressure)}`);
    }

    // TensorFlow Information
    if (metrics.tensorflow) {
      console.log(
        '%c🧠 TensorFlow',
        'color: #FF6F00; font-weight: bold; font-size: 12px'
      );
      console.log(`   Backend: ${metrics.tensorflow.backend}`);
      console.log(`   Tensors: ${metrics.tensorflow.numTensors}`);
      console.log(`   Memory: ${this.formatBytes(metrics.tensorflow.numBytes)}`);
      console.log(`   Models: ${metrics.tensorflow.modelCount}`);
    }

    // Cache Metrics
    if (metrics.caches) {
      console.log(
        '%c📦 Caches',
        'color: #4CAF50; font-weight: bold; font-size: 12px'
      );
      console.log(`   Total Entries: ${metrics.caches.total.entries}`);
      console.log(`   Memory Usage: ${metrics.caches.total.memoryMB.toFixed(2)} MB`);
      console.log(`   Hit Rate: ${(metrics.caches.total.hitRate * 100).toFixed(1)}%`);
    }

    // AI System
    if (metrics.ai) {
      console.log(
        '%c🤖 AI System',
        'color: #00BCD4; font-weight: bold; font-size: 12px'
      );
      console.log(`   Mode: ${metrics.ai.currentMode}${metrics.ai.defensiveMode ? ' (Defensive)' : ''}`);
      console.log(`   Device: ${metrics.ai.inferenceDevice}`);
      console.log(`   Avg Inference: ${metrics.ai.avgInferenceTime.toFixed(2)} ms`);
      console.log(`   Lightweight: ${metrics.ai.lightweightActive ? 'Active' : 'Inactive'}`);
    }

    // Background Tasks
    if (metrics.background) {
      console.log(
        '%c⚡ Background Tasks',
        'color: #9C27B0; font-weight: bold; font-size: 12px'
      );
      console.log(`   Queued: ${metrics.background.tasksQueued}`);
      console.log(`   Running: ${metrics.background.tasksRunning}`);
      console.log(`   Deferred: ${metrics.background.tasksDeferred}`);
      console.log(`   Status: ${metrics.background.isPaused ? '⏸️ Paused' : '▶️ Active'}`);
    }

    // Degradation Status
    if (metrics.degradation) {
      console.log(
        '%c🛡️ Degradation',
        'color: #F44336; font-weight: bold; font-size: 12px'
      );
      console.log(`   Level: ${this.getDegradationLevelName(metrics.degradation.level)}`);
      console.log(`   Rate Limit: ${metrics.degradation.rateLimits.requestsPerSecond} req/s`);
      console.log(`   Active Clients: ${metrics.degradation.activeClients}`);
      if (metrics.degradation.blockedClients > 0) {
        console.log(`   Blocked Clients: ${metrics.degradation.blockedClients}`);
      }
    }

    console.groupEnd();
  }

  logAlert(alert: { level: string; message: string; timestamp: number }) {
    if (!this.isEnabled) return;

    const alertColors = {
      low: '#4CAF50',
      moderate: '#FF9800',
      high: '#f44336',
      critical: '#B71C1C'
    };

    const alertEmojis = {
      low: '✅',
      moderate: '⚠️',
      high: '🚨',
      critical: '🆘'
    };

    const color = alertColors[alert.level as keyof typeof alertColors] || '#757575';
    const emoji = alertEmojis[alert.level as keyof typeof alertEmojis] || '📢';

    console.log(
      `%c${emoji} [${new Date(alert.timestamp).toLocaleTimeString()}] Memory Alert: ${alert.message}`,
      `color: ${color}; font-weight: bold; font-size: 14px`
    );
  }

  logDegradation(data: { 
    previousLevel: number; 
    currentLevel: number; 
    timestamp: number 
  }) {
    if (!this.isEnabled) return;

    const levelNames = ['None', 'Light', 'Moderate', 'Heavy', 'Critical'];
    const levelColors = ['#4CAF50', '#8BC34A', '#FF9800', '#FF5722', '#B71C1C'];

    console.log(
      `%c🔄 [${new Date(data.timestamp).toLocaleTimeString()}] Degradation Level Changed: ${
        levelNames[data.previousLevel] || 'Unknown'
      } → ${levelNames[data.currentLevel] || 'Unknown'}`,
      `color: ${levelColors[data.currentLevel] || '#757575'}; font-weight: bold`
    );
  }

  getMemoryTrend(): string {
    if (this.metricsHistory.length < 2) return 'stable';

    const recent = this.metricsHistory.slice(-5).filter(m => m.memory);
    if (recent.length === 0) return 'unknown';
    
    const avgRecent = recent.reduce((sum, m) => sum + (m.memory?.system.percentage || 0), 0) / recent.length;
    const previous = this.metricsHistory.slice(-10, -5).filter(m => m.memory);
    if (previous.length === 0) return 'stable';
    
    const avgPrevious = previous.reduce((sum, m) => sum + (m.memory?.system.percentage || 0), 0) / previous.length;

    if (avgRecent > avgPrevious + 5) return 'increasing';
    if (avgRecent < avgPrevious - 5) return 'decreasing';
    return 'stable';
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  private formatPressure(pressure: string): string {
    const pressureEmoji = {
      low: '✅',
      moderate: '⚠️',
      high: '🚨',
      critical: '🆘'
    };
    return `${pressureEmoji[pressure as keyof typeof pressureEmoji] || '❓'} ${pressure}`;
  }

  private getDegradationLevelName(level: number): string {
    const levels = ['None', 'Light', 'Moderate', 'Heavy', 'Critical'];
    return levels[level] || `Level ${level}`;
  }

  private getMemoryPressure(percentage: number): {
    level: string;
    color: string;
    emoji: string;
  } {
    if (percentage < 60) {
      return { level: 'Low', color: '#4CAF50', emoji: '✅' };
    } else if (percentage < 75) {
      return { level: 'Moderate', color: '#FF9800', emoji: '⚠️' };
    } else if (percentage < 90) {
      return { level: 'High', color: '#FF5722', emoji: '🚨' };
    } else {
      return { level: 'Critical', color: '#B71C1C', emoji: '🆘' };
    }
  }
}

export const memoryLogger = MemoryConsoleLogger.getInstance();