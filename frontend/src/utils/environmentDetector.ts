// Intelligent Environment Detection and Service Configuration
// Automatically detects runtime environment and configures service endpoints

export interface ServiceEndpoint {
  local: string;
  production: string;
  development?: string;
  staging?: string;
}

export interface EnvironmentInfo {
  type: 'local' | 'production' | 'development' | 'staging';
  isLocal: boolean;
  isProduction: boolean;
  isDevelopment: boolean;
  isStaging: boolean;
  isVercel: boolean;
  isRender: boolean;
  isNetlify: boolean;
  hostname: string;
  protocol: string;
  port: string;
  baseUrl: string;
}

export interface ServiceConfiguration {
  backend: string;
  mlService: string;
  mlInference: string;
  continuousLearning: string;
  aiCoordination: string;
  pythonTrainer: string;
  integrationWebSocket: string;
}

class EnvironmentDetector {
  private static instance: EnvironmentDetector;
  private environmentInfo: EnvironmentInfo | null = null;
  
  // Service endpoint configurations
  private readonly serviceEndpoints: Record<string, ServiceEndpoint> = {
    backend: {
      // Backend default in this repo is 3000
      local: 'http://localhost:3000',
      // In production, prefer explicit env override; otherwise default to same-origin
      production: process.env.REACT_APP_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}` : ''),
      development: process.env.REACT_APP_DEV_API_URL || 'http://localhost:3000',
      staging: process.env.REACT_APP_STAGING_API_URL || 'https://connect-four-staging.onrender.com'
    },
    mlService: {
      local: 'http://localhost:8000',
      production: process.env.REACT_APP_ML_SERVICE_URL || 'https://connect-four-ml.onrender.com',
      development: 'http://localhost:8000',
      staging: 'https://connect-four-ml-staging.onrender.com'
    },
    mlInference: {
      local: 'http://localhost:8001',
      production: process.env.REACT_APP_ML_INFERENCE_URL || 'https://connect-four-ml.onrender.com/inference',
      development: 'http://localhost:8001',
      staging: 'https://connect-four-ml-staging.onrender.com/inference'
    },
    continuousLearning: {
      local: 'http://localhost:8002',
      production: process.env.REACT_APP_CL_SERVICE_URL || 'https://connect-four-ml.onrender.com/learning',
      development: 'http://localhost:8002',
      staging: 'https://connect-four-ml-staging.onrender.com/learning'
    },
    aiCoordination: {
      local: 'http://localhost:8003',
      production: process.env.REACT_APP_AI_COORD_URL || 'https://connect-four-ml.onrender.com/coordination',
      development: 'http://localhost:8003',
      staging: 'https://connect-four-ml-staging.onrender.com/coordination'
    },
    pythonTrainer: {
      local: 'http://localhost:8004',
      production: process.env.REACT_APP_TRAINER_URL || 'https://connect-four-ml.onrender.com/trainer',
      development: 'http://localhost:8004',
      staging: 'https://connect-four-ml-staging.onrender.com/trainer'
    },
    integrationWebSocket: {
      local: 'ws://localhost:8888',
      production: process.env.REACT_APP_INTEGRATION_WS_URL || 'wss://connect-four-ai-roge.onrender.com/integration',
      development: 'ws://localhost:8888',
      staging: 'wss://connect-four-staging.onrender.com/integration'
    }
  };

  private constructor() {
    this.detectEnvironment();
  }

  public static getInstance(): EnvironmentDetector {
    if (!EnvironmentDetector.instance) {
      EnvironmentDetector.instance = new EnvironmentDetector();
    }
    return EnvironmentDetector.instance;
  }

  private detectEnvironment(): void {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;

    // Detect deployment platform
    const isVercel = hostname.includes('vercel.app') || 
                    hostname.includes('.vercel.app') ||
                    !!process.env.REACT_APP_VERCEL_ENV;
    
    const isRender = hostname.includes('onrender.com') ||
                     hostname.includes('.onrender.com') ||
                     !!process.env.REACT_APP_RENDER;
    
    const isNetlify = hostname.includes('netlify.app') ||
                      hostname.includes('.netlify.app') ||
                      !!process.env.REACT_APP_NETLIFY;

    // Detect environment type
    const isLocal = hostname === 'localhost' || 
                   hostname === '127.0.0.1' ||
                   hostname.startsWith('192.168.') ||
                   hostname.startsWith('10.') ||
                   hostname.includes('.local') ||
                   port === '3000' || 
                   port === '3001';

    const isStaging = hostname.includes('staging') ||
                     hostname.includes('stage') ||
                     hostname.includes('preview') ||
                     process.env.REACT_APP_ENV === 'staging';

    const isDevelopment = hostname.includes('dev') ||
                         hostname.includes('development') ||
                         process.env.REACT_APP_ENV === 'development' ||
                         process.env.NODE_ENV === 'development';

    const isProduction = !isLocal && !isStaging && !isDevelopment;

    // Determine environment type
    let type: EnvironmentInfo['type'] = 'production';
    if (isLocal) type = 'local';
    else if (isStaging) type = 'staging';
    else if (isDevelopment) type = 'development';

    this.environmentInfo = {
      type,
      isLocal,
      isProduction,
      isDevelopment,
      isStaging,
      isVercel,
      isRender,
      isNetlify,
      hostname,
      protocol,
      port,
      baseUrl: `${protocol}//${hostname}${port ? `:${port}` : ''}`
    };

    // Log environment detection results
    console.log('🌍 Environment Detection Results:', {
      ...this.environmentInfo,
      detectedServices: this.getServiceConfiguration()
    });
  }

  public getEnvironmentInfo(): EnvironmentInfo {
    if (!this.environmentInfo) {
      this.detectEnvironment();
    }
    return this.environmentInfo!;
  }

  public getServiceUrl(service: string): string {
    const env = this.getEnvironmentInfo();
    const endpoint = this.serviceEndpoints[service as keyof typeof this.serviceEndpoints];
    
    if (!endpoint) {
      console.warn(`⚠️ Unknown service: ${service}`);
      return '';
    }

    // Return appropriate URL based on environment
    if (env.isLocal) return endpoint.local;
    if (env.isStaging && endpoint.staging) return endpoint.staging;
    if (env.isDevelopment && endpoint.development) return endpoint.development;
    return endpoint.production;
  }

  public getServiceConfiguration(): ServiceConfiguration {
    const cfg = {
      backend: this.getServiceUrl('backend'),
      mlService: this.getServiceUrl('mlService'),
      mlInference: this.getServiceUrl('mlInference'),
      continuousLearning: this.getServiceUrl('continuousLearning'),
      aiCoordination: this.getServiceUrl('aiCoordination'),
      pythonTrainer: this.getServiceUrl('pythonTrainer'),
      integrationWebSocket: this.getServiceUrl('integrationWebSocket')
    };

    // If running in a browser (e.g., Vercel), prefer same-origin backend to avoid CORS
    try {
      if (typeof window !== 'undefined') {
        const sameOrigin = `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`;
        // If production and no explicit override, stick to same-origin
        if (this.environmentInfo?.isProduction && !process.env.REACT_APP_API_URL) {
          cfg.backend = sameOrigin;
        }
      }
    } catch {}

    return cfg;
  }

  public shouldUseLocalServices(): boolean {
    return this.getEnvironmentInfo().isLocal;
  }

  public shouldEnableDevelopmentFeatures(): boolean {
    const env = this.getEnvironmentInfo();
    return env.isLocal || env.isDevelopment;
  }

  public getHealthCheckEndpoints(): Array<{ name: string; url: string }> {
    const env = this.getEnvironmentInfo();
    const config = this.getServiceConfiguration();

    // In production, only check main backend health
    if (env.isProduction) {
      // In production, use same-origin backend to avoid CORS errors
      const origin = `${env.protocol}//${env.hostname}${env.port ? `:${env.port}` : ''}`;
      return [
        { name: 'Backend API', url: `${origin}/api/health` }
      ];
    }

    // In local/dev, check all services
    return [
      { name: 'Backend API', url: `${config.backend}/api/health` },
      { name: 'ML Service', url: `${config.mlService}/health` },
      { name: 'ML Inference', url: `${config.mlInference}/health` },
      { name: 'Continuous Learning', url: `${config.continuousLearning}/health` },
      { name: 'AI Coordination', url: `${config.aiCoordination}/health` },
      { name: 'Python Trainer', url: `${config.pythonTrainer}/health` }
    ];
  }

  public getWebSocketUrl(): string {
    const config = this.getServiceConfiguration();
    return config.backend; // WebSocket connects to main backend
  }

  public getIntegrationWebSocketUrl(): string {
    const config = this.getServiceConfiguration();
    return config.integrationWebSocket;
  }

  // Helper method to check if a service is available
  public async isServiceAvailable(serviceUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${serviceUrl}/health`, {
        method: 'GET',
        mode: 'cors',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Get configuration for external monitoring tools
  public getMonitoringConfig() {
    const env = this.getEnvironmentInfo();
    return {
      enableSentry: env.isProduction || env.isStaging,
      enableAnalytics: env.isProduction,
      enableDebugTools: env.isLocal || env.isDevelopment,
      logLevel: env.isProduction ? 'error' : 'debug'
    };
  }
}

// Export singleton instance
export const environmentDetector = EnvironmentDetector.getInstance();

// Export convenience functions
export const getServiceUrl = (service: keyof ServiceConfiguration) => 
  environmentDetector.getServiceUrl(service as any);

export const getEnvironmentInfo = () => 
  environmentDetector.getEnvironmentInfo();

export const isLocalDevelopment = () => 
  environmentDetector.shouldUseLocalServices();

export const getHealthCheckEndpoints = () => 
  environmentDetector.getHealthCheckEndpoints();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).environmentDetector = environmentDetector;
}