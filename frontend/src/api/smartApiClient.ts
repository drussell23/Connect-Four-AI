// Smart API Client with Environment-Aware Endpoint Selection
// Automatically routes requests to appropriate services based on environment

import { environmentDetector } from '../utils/environmentDetector';
import { buildApiEndpoint } from '../config/environment';

export interface ApiRequestOptions extends RequestInit {
  service?: 'backend' | 'mlService' | 'mlInference' | 'continuousLearning' | 'aiCoordination' | 'pythonTrainer';
  timeout?: number;
  retries?: number;
  fallbackToBackend?: boolean;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
  ok: boolean;
  service: string;
  responseTime: number;
}

class SmartApiClient {
  private static instance: SmartApiClient;
  private serviceConfig = environmentDetector.getServiceConfiguration();
  private environmentInfo = environmentDetector.getEnvironmentInfo();

  private constructor() {
    console.log('🔌 Smart API Client initialized:', {
      environment: this.environmentInfo.type,
      services: this.serviceConfig
    });
  }

  public static getInstance(): SmartApiClient {
    if (!SmartApiClient.instance) {
      SmartApiClient.instance = new SmartApiClient();
    }
    return SmartApiClient.instance;
  }

  /**
   * Make an API request with intelligent endpoint selection
   */
  public async request<T = any>(
    path: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      service = 'backend',
      timeout = 10000,
      retries = 3,
      fallbackToBackend = true,
      ...fetchOptions
    } = options;

    const startTime = Date.now();
    let lastError: Error | null = null;
    let serviceUrl = this.getServiceUrl(service);

    // For backend service, use buildApiEndpoint to handle /api prefix
    if (service === 'backend') {
      const fullUrl = buildApiEndpoint(path);
      return this.performRequest(fullUrl, fetchOptions, timeout, retries, service, startTime);
    }

    // For other services, construct URL directly
    const fullUrl = `${serviceUrl}${path.startsWith('/') ? path : '/' + path}`;

    // Try primary service
    try {
      return await this.performRequest(fullUrl, fetchOptions, timeout, retries, service, startTime);
    } catch (error) {
      lastError = error as Error;
      console.warn(`⚠️ Primary service ${service} failed:`, error);

      // Fallback to backend if enabled
      if (fallbackToBackend) {
        console.log(`🔄 Falling back to backend service for ${path}`);
        const backendUrl = buildApiEndpoint(path);
        
        try {
          return await this.performRequest(
            backendUrl, 
            fetchOptions, 
            timeout, 
            retries, 
            'backend (fallback)', 
            startTime
          );
        } catch (fallbackError) {
          console.error('❌ Fallback to backend also failed:', fallbackError);
        }
      }
    }

    // Return error response
    return {
      error: lastError?.message || 'Request failed',
      status: 0,
      ok: false,
      service,
      responseTime: Date.now() - startTime
    };
  }

  /**
   * Perform the actual request with retries
   */
  private async performRequest<T>(
    url: string,
    options: RequestInit,
    timeout: number,
    retries: number,
    serviceName: string,
    startTime: number
  ): Promise<ApiResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          mode: 'cors',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers
          }
        });

        clearTimeout(timeoutId);

        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          let data: T | undefined;

          if (contentType?.includes('application/json')) {
            data = await response.json();
          } else {
            data = await response.text() as any;
          }

          return {
            data,
            status: response.status,
            ok: true,
            service: serviceName,
            responseTime
          };
        } else {
          // Non-OK response
          const error = await response.text().catch(() => 'Unknown error');
          
          return {
            error,
            status: response.status,
            ok: false,
            service: serviceName,
            responseTime
          };
        }
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries - 1) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.log(`⏳ Retrying request to ${serviceName} in ${delay}ms (attempt ${attempt + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * Get service URL based on service name
   */
  private getServiceUrl(service: string): string {
    const serviceMap: Record<string, keyof typeof this.serviceConfig> = {
      backend: 'backend',
      mlService: 'mlService',
      mlInference: 'mlInference',
      continuousLearning: 'continuousLearning',
      aiCoordination: 'aiCoordination',
      pythonTrainer: 'pythonTrainer'
    };

    const configKey = serviceMap[service];
    return configKey ? this.serviceConfig[configKey] : this.serviceConfig.backend;
  }

  /**
   * Convenience methods for common HTTP verbs
   */
  public async get<T = any>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  public async post<T = any>(path: string, data?: any, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  public async put<T = any>(path: string, data?: any, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  public async delete<T = any>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  /**
   * Check health of a specific service
   */
  public async checkServiceHealth(service: ApiRequestOptions['service'] = 'backend'): Promise<boolean> {
    try {
      const response = await this.get('/health', { 
        service, 
        timeout: 3000,
        retries: 1,
        fallbackToBackend: false 
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current environment and service configuration
   */
  public getConfiguration() {
    return {
      environment: this.environmentInfo,
      services: this.serviceConfig
    };
  }
}

// Export singleton instance
export const smartApiClient = SmartApiClient.getInstance();

// Export convenience functions
export const apiGet = <T = any>(path: string, options?: ApiRequestOptions) => 
  smartApiClient.get<T>(path, options);

export const apiPost = <T = any>(path: string, data?: any, options?: ApiRequestOptions) => 
  smartApiClient.post<T>(path, data, options);

export const apiPut = <T = any>(path: string, data?: any, options?: ApiRequestOptions) => 
  smartApiClient.put<T>(path, data, options);

export const apiDelete = <T = any>(path: string, options?: ApiRequestOptions) => 
  smartApiClient.delete<T>(path, options);

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).smartApiClient = smartApiClient;
}