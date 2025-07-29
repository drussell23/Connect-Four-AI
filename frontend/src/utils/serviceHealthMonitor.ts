// Service Health Monitor
// Periodically checks health of all integrated services

import { integrationLogger } from './integrationLogger';

interface ServiceEndpoint {
  name: string;
  url: string;
  checkInterval: number;
  lastCheck?: Date;
  lastStatus?: boolean;
  consecutiveFailures: number;
}

class ServiceHealthMonitor {
  private services: ServiceEndpoint[] = [];

  constructor() {
    // Only monitor localhost services in development
    if (this.isLocalDevelopment()) {
      this.services = [
        {
          name: 'ML Service',
          url: 'http://localhost:8000/health',
          checkInterval: 30000,
          consecutiveFailures: 0
        },
        {
          name: 'ML Inference',
          url: 'http://localhost:8001/health',
          checkInterval: 30000,
          consecutiveFailures: 0
        },
        {
          name: 'Continuous Learning',
          url: 'http://localhost:8002/health',
          checkInterval: 30000,
          consecutiveFailures: 0
        },
        {
          name: 'AI Coordination',
          url: 'http://localhost:8003/health',
          checkInterval: 30000,
          consecutiveFailures: 0
        },
        {
          name: 'Python Trainer',
          url: 'http://localhost:8004/health',
          checkInterval: 30000,
          consecutiveFailures: 0
        }
      ];
    }
  }

  private isLocalDevelopment(): boolean {
    // Check if we're running locally (not on Vercel or other production hosts)
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname.includes('localhost');
  }

  private intervalId: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  public async checkService(service: ServiceEndpoint): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const startTime = Date.now();
      const response = await fetch(service.url, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      const isHealthy = response.ok;
      service.lastCheck = new Date();
      service.lastStatus = isHealthy;

      if (isHealthy) {
        service.consecutiveFailures = 0;
        
        // Log performance metrics
        integrationLogger.logPerformanceMetrics({
          service: service.name,
          responseTime,
          activeConnections: 1
        });
      } else {
        service.consecutiveFailures++;
      }

      // Log connection status change
      if (service.lastStatus !== isHealthy || service.consecutiveFailures === 1) {
        integrationLogger.logServiceConnection(service.name, isHealthy, {
          responseTime,
          consecutiveFailures: service.consecutiveFailures
        });
      }

      return isHealthy;
    } catch (error) {
      service.consecutiveFailures++;
      service.lastCheck = new Date();
      service.lastStatus = false;

      // Log error on first failure or every 5th consecutive failure
      if (service.consecutiveFailures === 1 || service.consecutiveFailures % 5 === 0) {
        integrationLogger.logError(service.name, {
          message: 'Health check failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          consecutiveFailures: service.consecutiveFailures
        });
      }

      return false;
    }
  }

  public async checkAllServices(): Promise<void> {
    // Skip health checks in production
    if (this.services.length === 0) {
      return;
    }
    
    console.log('🔍 Checking service health...');
    
    const checks = this.services.map(service => this.checkService(service));
    const results = await Promise.allSettled(checks);
    
    const healthyCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const totalCount = this.services.length;
    
    console.log(`📊 Service Health: ${healthyCount}/${totalCount} services healthy`);
  }

  public startMonitoring(): void {
    // Skip monitoring in production
    if (this.services.length === 0) {
      console.log('📦 Service monitoring disabled in production');
      return;
    }
    
    if (this.isMonitoring) {
      console.log('⚠️ Service monitoring already active');
      return;
    }

    console.log('🚀 Starting service health monitoring...');
    this.isMonitoring = true;

    // Initial check
    this.checkAllServices();

    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.checkAllServices();
    }, 30000); // Check every 30 seconds
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.log('⚠️ Service monitoring not active');
      return;
    }

    console.log('🛑 Stopping service health monitoring...');
    this.isMonitoring = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public getServiceStatus(): { name: string; status: string; lastCheck: string }[] {
    return this.services.map(service => ({
      name: service.name,
      status: service.lastStatus === undefined ? '❓ Unknown' :
              service.lastStatus ? '✅ Healthy' : '❌ Unhealthy',
      lastCheck: service.lastCheck ? service.lastCheck.toLocaleTimeString() : 'Never'
    }));
  }

  public async testIntegration(): Promise<void> {
    console.group('%c🧪 Testing Service Integration', 'font-size: 16px; color: #4CAF50; font-weight: bold;');
    
    // Test each service
    for (const service of this.services) {
      const startTime = Date.now();
      const isHealthy = await this.checkService(service);
      const responseTime = Date.now() - startTime;
      
      console.log(
        `${isHealthy ? '✅' : '❌'} ${service.name}: ${responseTime}ms`,
        isHealthy ? 'color: #4CAF50' : 'color: #f44336'
      );
    }
    
    console.groupEnd();
    
    // Show integration events
    integrationLogger.showDashboard();
  }
}

// Create singleton instance
export const serviceHealthMonitor = new ServiceHealthMonitor();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).serviceHealthMonitor = serviceHealthMonitor;
}