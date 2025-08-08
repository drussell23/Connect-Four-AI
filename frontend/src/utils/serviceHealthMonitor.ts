// Service Health Monitor
// Periodically checks health of all integrated services

import { integrationLogger } from './integrationLogger';
import { environmentDetector, getHealthCheckEndpoints } from './environmentDetector';

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
  private environmentInfo = environmentDetector.getEnvironmentInfo();

  constructor() {
    this.initializeServices();
  }

  private getHealthTimeoutMs(): number {
    try {
      const env = this.environmentInfo;
      // Reduced timeouts to prevent UI blocking
      // ML services often fail in production, so use shorter timeout
      return env.isProduction ? 3000 : 5000;
    } catch {
      return 3000;
    }
  }

  private initializeServices(): void {
    // Get health check endpoints based on environment
    const endpoints = getHealthCheckEndpoints();
    
    this.services = endpoints.map(endpoint => ({
      name: endpoint.name,
      url: endpoint.url,
      checkInterval: 30000,
      consecutiveFailures: 0
    }));

    console.log(`🔧 Service Health Monitor initialized for ${this.environmentInfo.type} environment:`, {
      environment: this.environmentInfo,
      monitoringServices: this.services.map(s => ({ name: s.name, url: s.url }))
    });
  }

  private intervalId: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  public async checkService(service: ServiceEndpoint): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutMs = this.getHealthTimeoutMs();
      const timeoutId = setTimeout(() => {
        controller.abort(new DOMException(`Health check timeout after ${Math.round(timeoutMs/1000)}s`, 'TimeoutError'));
      }, timeoutMs);
      
      const startTime = Date.now();
      const response = await fetch(service.url, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        },
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
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          if (error.name === 'TimeoutError') {
            errorMessage = `Health check timeout (${Math.round(this.getHealthTimeoutMs()/1000)}s)`;
          } else if (error.name === 'AbortError') {
            errorMessage = error.message || 'Request aborted';
          } else {
            errorMessage = error.message;
          }
        }
        
        integrationLogger.logError(service.name, {
          message: 'Health check failed',
          error: errorMessage,
          consecutiveFailures: service.consecutiveFailures,
          url: service.url
        });
      }

      return false;
    }
  }

  public async checkAllServices(): Promise<void> {
    // If production and cross-origin, limit to same-origin backend health to avoid CORS
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
    if (this.services.length === 0) {
      console.log(`📦 No services to monitor in ${this.environmentInfo.type} environment`);
      return;
    }
    
    if (this.isMonitoring) {
      console.log('⚠️ Service monitoring already active');
      return;
    }

    console.log(`🚀 Starting service health monitoring in ${this.environmentInfo.type} environment...`);
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