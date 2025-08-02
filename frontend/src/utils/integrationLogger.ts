// Integration Service Logger for Console
// Provides detailed logging of all service integration activities

export interface ServiceEvent {
  timestamp: Date;
  service: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'metric' | 'ai';
  message: string;
  data?: any;
  metrics?: {
    latency?: number;
    confidence?: number;
    difficulty?: number;
    strategy?: string;
    algorithm?: string;
  };
}

export interface ServiceStatus {
  backend: boolean;
  ml: boolean;
  inference: boolean;
  coordination: boolean;
  learning: boolean;
  trainer: boolean;
  integration: boolean;
}

class IntegrationLogger {
  private events: ServiceEvent[] = [];
  private maxEvents: number = 1000;
  private logToConsole: boolean = true;
  private detailedMode: boolean = true;
  private serviceStatus: ServiceStatus = {
    backend: false,
    ml: false,
    inference: false,
    coordination: false,
    learning: false,
    trainer: false,
    integration: false
  };

  constructor() {
    // Create custom console styling
    this.initializeConsoleStyles();
    this.logServiceHeader();
    
    // In production, services may appear disconnected due to network isolation
    if (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost') {
      console.log(
        '%c📌 Note: In production, microservices communicate internally through the backend',
        'color: #FFC107; font-style: italic;'
      );
    }
  }

  private initializeConsoleStyles(): void {
    // Define custom console styles
    console.log(
      '%c🎮 Connect Four AI - Service Integration Monitor 🎮',
      'font-size: 20px; font-weight: bold; color: #4CAF50; background: #1a1a1a; padding: 10px; border-radius: 5px;'
    );
  }

  private logServiceHeader(): void {
    console.group('%c📊 Service Integration Status', 'font-size: 16px; color: #2196F3; font-weight: bold;');
    console.table({
      'Backend API': { Port: 3000, Status: '🔄 Connecting...' },
      'ML Service': { Port: 8000, Status: '🔄 Connecting...' },
      'ML Inference': { Port: 8001, Status: '🔄 Connecting...' },
      'AI Coordination': { Port: 8003, Status: '🔄 Connecting...' },
      'Continuous Learning': { Port: 8002, Status: '🔄 Connecting...' },
      'Python Trainer': { Port: 8004, Status: '🔄 Connecting...' },
      'Integration WebSocket': { Port: 8888, Status: '🔄 Connecting...' }
    });
    console.groupEnd();
  }

  // Log service connection
  public logServiceConnection(service: string, connected: boolean, details?: any): void {
    const event: ServiceEvent = {
      timestamp: new Date(),
      service,
      type: connected ? 'success' : 'error',
      message: connected ? `✅ ${service} connected` : `❌ ${service} disconnected`,
      data: details
    };

    this.addEvent(event);
    
    if (this.logToConsole) {
      const style = connected 
        ? 'color: #4CAF50; font-weight: bold;' 
        : 'color: #f44336; font-weight: bold;';
      
      console.log(`%c${event.message}`, style, details || '');
    }

    // Update service status
    this.updateServiceStatus(service, connected);
  }

  // Log AI decision
  public logAIDecision(decision: {
    column: number;
    confidence: number;
    algorithm: string;
    difficulty: number;
    timeMs: number;
    strategy?: string;
    alternatives?: Array<{ column: number; score: number }>;
  }): void {
    const event: ServiceEvent = {
      timestamp: new Date(),
      service: 'AI Engine',
      type: 'ai',
      message: `🤖 AI Move Decision`,
      data: decision,
      metrics: {
        latency: decision.timeMs,
        confidence: decision.confidence,
        difficulty: decision.difficulty,
        strategy: decision.strategy,
        algorithm: decision.algorithm
      }
    };

    this.addEvent(event);

    if (this.logToConsole && this.detailedMode) {
      console.group('%c🤖 AI Decision Analysis', 'color: #9C27B0; font-size: 14px; font-weight: bold;');
      console.log('%cColumn:', 'font-weight: bold;', decision.column);
      console.log('%cConfidence:', 'font-weight: bold;', `${(decision.confidence * 100).toFixed(1)}%`);
      console.log('%cAlgorithm:', 'font-weight: bold;', decision.algorithm);
      console.log('%cDifficulty:', 'font-weight: bold;', decision.difficulty);
      console.log('%cLatency:', 'font-weight: bold;', `${decision.timeMs}ms`);
      
      if (decision.strategy) {
        console.log('%cStrategy:', 'font-weight: bold;', decision.strategy);
      }
      
      if (decision.alternatives && decision.alternatives.length > 0) {
        console.log('%cAlternative Moves:', 'font-weight: bold;');
        console.table(decision.alternatives);
      }
      
      console.groupEnd();
    }
  }

  // Log WebSocket event
  public logWebSocketEvent(event: string, data: any, direction: 'in' | 'out'): void {
    const icon = direction === 'in' ? '📥' : '📤';
    const color = direction === 'in' ? '#2196F3' : '#FF9800';
    
    const serviceEvent: ServiceEvent = {
      timestamp: new Date(),
      service: 'WebSocket',
      type: 'info',
      message: `${icon} ${event}`,
      data
    };

    this.addEvent(serviceEvent);

    if (this.logToConsole) {
      console.log(
        `%c${icon} WS ${direction.toUpperCase()}: ${event}`,
        `color: ${color}; font-weight: bold;`,
        data
      );
    }
  }

  // Log service integration event
  public logIntegrationEvent(source: string, target: string, eventType: string, data?: any): void {
    const event: ServiceEvent = {
      timestamp: new Date(),
      service: 'Integration',
      type: 'info',
      message: `🔗 ${source} → ${target}: ${eventType}`,
      data
    };

    this.addEvent(event);

    if (this.logToConsole && this.detailedMode) {
      console.log(
        `%c🔗 Integration: ${source} → ${target}`,
        'color: #00BCD4; font-weight: bold;',
        eventType,
        data || ''
      );
    }
  }

  // Log performance metrics
  public logPerformanceMetrics(metrics: {
    service: string;
    responseTime: number;
    queueSize?: number;
    activeConnections?: number;
    memoryUsage?: number;
  }): void {
    const event: ServiceEvent = {
      timestamp: new Date(),
      service: metrics.service,
      type: 'metric',
      message: `📊 Performance: ${metrics.service}`,
      data: metrics,
      metrics: {
        latency: metrics.responseTime
      }
    };

    this.addEvent(event);

    if (this.logToConsole && this.detailedMode) {
      const color = metrics.responseTime < 100 ? '#4CAF50' : 
                    metrics.responseTime < 500 ? '#FF9800' : '#f44336';
      
      console.log(
        `%c📊 ${metrics.service} Performance`,
        'font-weight: bold; color: #9E9E9E;',
        `Response: %c${metrics.responseTime}ms`,
        `color: ${color}; font-weight: bold;`,
        metrics
      );
    }
  }

  // Log learning event
  public logLearningEvent(event: {
    type: 'pattern_detected' | 'model_updated' | 'strategy_adapted';
    details: any;
    improvement?: number;
  }): void {
    const icons = {
      pattern_detected: '🔍',
      model_updated: '🔄',
      strategy_adapted: '🎯'
    };

    const serviceEvent: ServiceEvent = {
      timestamp: new Date(),
      service: 'Learning System',
      type: 'success',
      message: `${icons[event.type]} ${event.type.replace('_', ' ').toUpperCase()}`,
      data: event.details
    };

    this.addEvent(serviceEvent);

    if (this.logToConsole) {
      console.group(
        `%c${icons[event.type]} Learning System`,
        'color: #4CAF50; font-size: 14px; font-weight: bold;'
      );
      console.log('Event:', event.type);
      console.log('Details:', event.details);
      if (event.improvement) {
        console.log('Improvement:', `${(event.improvement * 100).toFixed(1)}%`);
      }
      console.groupEnd();
    }
  }

  // Log error
  public logError(service: string, error: any): void {
    const event: ServiceEvent = {
      timestamp: new Date(),
      service,
      type: 'error',
      message: `❌ Error in ${service}`,
      data: error
    };

    this.addEvent(event);

    if (this.logToConsole) {
      console.error(`❌ ${service} Error:`, error);
    }
  }

  // Update service status
  private updateServiceStatus(service: string, connected: boolean): void {
    const serviceMap: { [key: string]: keyof ServiceStatus } = {
      'Backend API': 'backend',
      'ML Service': 'ml',
      'ML Inference': 'inference',
      'AI Coordination': 'coordination',
      'Continuous Learning': 'learning',
      'Python Trainer': 'trainer',
      'Integration WebSocket': 'integration'
    };

    const key = serviceMap[service];
    if (key) {
      this.serviceStatus[key] = connected;
    }
    
    // In production, show a note if all services appear disconnected
    if (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost') {
      const allDisconnected = Object.values(this.serviceStatus).every(status => !status);
      if (allDisconnected && Object.keys(this.serviceStatus).some(k => this.serviceStatus[k as keyof ServiceStatus] === false)) {
        console.log(
          '%c💡 Service isolation is normal in production - the backend handles all inter-service communication',
          'color: #03A9F4; font-size: 12px;'
        );
      }
    }
  }

  // Update multiple service statuses from backend
  public updateServiceStatuses(statuses: {
    ml_service?: boolean;
    ml_inference?: boolean;
    continuous_learning?: boolean;
    ai_coordination?: boolean;
    python_trainer?: boolean;
    integration_websocket?: boolean;
  }): void {
    if (statuses.ml_service !== undefined) {
      this.updateServiceStatus('ML Service', statuses.ml_service);
      this.logServiceConnection('ML Service', statuses.ml_service);
    }
    if (statuses.ml_inference !== undefined) {
      this.updateServiceStatus('ML Inference', statuses.ml_inference);
      this.logServiceConnection('ML Inference', statuses.ml_inference);
    }
    if (statuses.continuous_learning !== undefined) {
      this.updateServiceStatus('Continuous Learning', statuses.continuous_learning);
      this.logServiceConnection('Continuous Learning', statuses.continuous_learning);
    }
    if (statuses.ai_coordination !== undefined) {
      this.updateServiceStatus('AI Coordination', statuses.ai_coordination);
      this.logServiceConnection('AI Coordination', statuses.ai_coordination);
    }
    if (statuses.python_trainer !== undefined) {
      this.updateServiceStatus('Python Trainer', statuses.python_trainer);
      this.logServiceConnection('Python Trainer', statuses.python_trainer);
    }
    if (statuses.integration_websocket !== undefined) {
      this.updateServiceStatus('Integration WebSocket', statuses.integration_websocket);
      this.logServiceConnection('Integration WebSocket', statuses.integration_websocket);
    }
  }

  // Get service summary
  public getServiceSummary(): void {
    console.group('%c📊 Service Integration Summary', 'font-size: 16px; color: #2196F3; font-weight: bold;');
    
    const services = [
      { name: 'Backend API', status: this.serviceStatus.backend },
      { name: 'ML Service', status: this.serviceStatus.ml },
      { name: 'ML Inference', status: this.serviceStatus.inference },
      { name: 'AI Coordination', status: this.serviceStatus.coordination },
      { name: 'Continuous Learning', status: this.serviceStatus.learning },
      { name: 'Python Trainer', status: this.serviceStatus.trainer },
      { name: 'Integration WebSocket', status: this.serviceStatus.integration }
    ];

    const summary = services.map(s => ({
      Service: s.name,
      Status: s.status ? '✅ Connected' : '❌ Disconnected',
      Health: s.status ? '🟢' : '🔴'
    }));

    console.table(summary);
    console.groupEnd();
  }

  // Add event to history
  private addEvent(event: ServiceEvent): void {
    this.events.push(event);
    
    // Limit event history
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  // Get recent events
  public getRecentEvents(count: number = 50): ServiceEvent[] {
    return this.events.slice(-count);
  }

  // Clear event history
  public clearEvents(): void {
    this.events = [];
    console.log('%c🗑️ Event history cleared', 'color: #9E9E9E;');
  }

  // Toggle detailed mode
  public toggleDetailedMode(): void {
    this.detailedMode = !this.detailedMode;
    console.log(
      `%c📊 Detailed logging: ${this.detailedMode ? 'ON' : 'OFF'}`,
      'color: #FF9800; font-weight: bold;'
    );
  }

  // Export events as JSON
  public exportEvents(): string {
    return JSON.stringify(this.events, null, 2);
  }

  // Show integration dashboard
  public showDashboard(): void {
    console.group('%c🎮 Integration Dashboard', 'font-size: 18px; color: #4CAF50; font-weight: bold;');
    
    this.getServiceSummary();
    
    console.group('%c📈 Recent Activity', 'font-size: 14px; color: #2196F3;');
    const recentEvents = this.getRecentEvents(10);
    recentEvents.forEach(event => {
      const time = event.timestamp.toLocaleTimeString();
      console.log(`${time} - ${event.message}`, event.data || '');
    });
    console.groupEnd();
    
    console.groupEnd();
  }
}

// Create singleton instance
export const integrationLogger = new IntegrationLogger();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).integrationLogger = integrationLogger;
  console.log(
    '%c💡 Tip: Use window.integrationLogger for debugging',
    'color: #FFC107; font-style: italic;'
  );
}