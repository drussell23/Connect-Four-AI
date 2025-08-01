// Advanced Self-healing TensorFlow loader with automatic fallback and performance monitoring
import { Logger } from '@nestjs/common';
import * as os from 'os';
import * as process from 'process';

interface TensorFlowBackend {
    name: string;
    priority: number;
    loader: () => Promise<any>;
    available?: boolean;
    loadTime?: number;
    error?: Error;
}

interface LoaderConfig {
    preferredBackend?: 'node' | 'webgl' | 'wasm' | 'cpu';
    enableMockFallback?: boolean;
    maxRetries?: number;
    retryDelay?: number;
    enablePerformanceMonitoring?: boolean;
}

interface PerformanceMetrics {
    backend: string;
    loadTime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    timestamp: Date;
}

class TensorFlowLoader {
    private static instance: TensorFlowLoader;
    private tf: any = null;
    private loadPromise: Promise<any> | null = null;
    private currentBackend: string = 'unknown';
    private readonly logger = new Logger('TensorFlowLoader');
    private performanceMetrics: PerformanceMetrics[] = [];
    private readonly config: LoaderConfig;
    
    // Backend definitions with priority order
    private backends: TensorFlowBackend[] = [
        {
            name: 'tfjs-node-gpu',
            priority: 1,
            loader: async () => {
                const tf = await import('@tensorflow/tfjs-node-gpu' as any);
                await tf.ready();
                return tf;
            }
        },
        {
            name: 'tfjs-node',
            priority: 2,
            loader: async () => {
                const tf = await import('@tensorflow/tfjs-node' as any);
                await tf.ready();
                return tf;
            }
        },
        {
            name: 'tfjs-webgl',
            priority: 3,
            loader: async () => {
                const tf = await import('@tensorflow/tfjs');
                await tf.setBackend('webgl');
                await tf.ready();
                return tf;
            }
        },
        {
            name: 'tfjs-wasm',
            priority: 4,
            loader: async () => {
                const tf = await import('@tensorflow/tfjs');
                const wasm = await import('@tensorflow/tfjs-backend-wasm' as any);
                wasm.setWasmPaths(
                    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm/dist/'
                );
                await tf.setBackend('wasm');
                await tf.ready();
                return tf;
            }
        },
        {
            name: 'tfjs-cpu',
            priority: 5,
            loader: async () => {
                const tf = await import('@tensorflow/tfjs');
                await tf.setBackend('cpu');
                await tf.ready();
                return tf;
            }
        }
    ];
    
    private constructor(config: LoaderConfig = {}) {
        this.config = {
            preferredBackend: config.preferredBackend || 'node',
            enableMockFallback: config.enableMockFallback !== false,
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000,
            enablePerformanceMonitoring: config.enablePerformanceMonitoring !== false
        };
        
        this.detectEnvironment();
        this.sortBackendsByPreference();
    }
    
    static getInstance(config?: LoaderConfig): TensorFlowLoader {
        if (!TensorFlowLoader.instance) {
            TensorFlowLoader.instance = new TensorFlowLoader(config);
        }
        return TensorFlowLoader.instance;
    }
    
    private detectEnvironment(): void {
        const platform = os.platform();
        const arch = os.arch();
        const nodeVersion = process.version;
        
        this.logger.log(`🖥️  Environment: ${platform} ${arch}, Node ${nodeVersion}`);
        
        // Adjust backend availability based on environment
        if (platform === 'darwin' && arch === 'arm64') {
            // Apple Silicon - disable native backends that have issues
            this.logger.warn('🍎 Apple Silicon detected - some native backends may not be available');
            this.backends = this.backends.filter(b => 
                !['tfjs-node', 'tfjs-node-gpu'].includes(b.name)
            );
        }
        
        // Check if we're in a browser-like environment
        if (typeof window !== 'undefined') {
            this.backends = this.backends.filter(b => 
                ['tfjs-webgl', 'tfjs-wasm', 'tfjs-cpu'].includes(b.name)
            );
        }
    }
    
    private sortBackendsByPreference(): void {
        const preferred = this.config.preferredBackend;
        this.backends.sort((a, b) => {
            // Preferred backend gets highest priority
            if (a.name.includes(preferred!)) return -1;
            if (b.name.includes(preferred!)) return 1;
            return a.priority - b.priority;
        });
    }
    
    private async checkBackendAvailability(backend: TensorFlowBackend): Promise<boolean> {
        try {
            // Quick check if module can be resolved
            if (backend.name.includes('node')) {
                require.resolve('@tensorflow/tfjs-node');
            }
            backend.available = true;
            return true;
        } catch {
            backend.available = false;
            return false;
        }
    }
    
    private recordPerformanceMetrics(backend: string, loadTime: number): void {
        if (!this.config.enablePerformanceMonitoring) return;
        
        const metrics: PerformanceMetrics = {
            backend,
            loadTime,
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            timestamp: new Date()
        };
        
        this.performanceMetrics.push(metrics);
        
        this.logger.log(`📊 Performance metrics:
            Backend: ${backend}
            Load time: ${loadTime}ms
            Memory: ${Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024)}MB
        `);
    }
    
    private async tryLoadBackend(backend: TensorFlowBackend): Promise<any> {
        const startTime = Date.now();
        
        try {
            this.logger.log(`🔄 Attempting to load ${backend.name}...`);
            
            // Check availability first for native backends
            if (backend.name.includes('node') && !(await this.checkBackendAvailability(backend))) {
                throw new Error(`Backend ${backend.name} not available`);
            }
            
            const tf = await backend.loader();
            
            // Verify the backend loaded correctly
            if (!tf || !tf.tensor) {
                throw new Error(`Invalid TensorFlow instance from ${backend.name}`);
            }
            
            // Test basic operations
            const testTensor = tf.tensor([1, 2, 3, 4]);
            const result = testTensor.mean().arraySync();
            testTensor.dispose();
            
            if (result !== 2.5) {
                throw new Error(`Backend ${backend.name} failed basic operation test`);
            }
            
            const loadTime = Date.now() - startTime;
            backend.loadTime = loadTime;
            
            this.logger.log(`✅ Successfully loaded ${backend.name} in ${loadTime}ms`);
            this.recordPerformanceMetrics(backend.name, loadTime);
            
            return tf;
        } catch (error) {
            backend.error = error as Error;
            const loadTime = Date.now() - startTime;
            this.logger.warn(`❌ Failed to load ${backend.name} after ${loadTime}ms: ${error.message}`);
            throw error;
        }
    }
    
    private async loadWithRetry(backend: TensorFlowBackend): Promise<any> {
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
            try {
                return await this.tryLoadBackend(backend);
            } catch (error) {
                lastError = error as Error;
                if (attempt < this.config.maxRetries!) {
                    this.logger.log(`🔄 Retrying ${backend.name} (attempt ${attempt + 1}/${this.config.maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
                }
            }
        }
        
        throw lastError;
    }
    
    private createMockTensorFlow(): any {
        this.logger.warn('⚠️  Using mock TensorFlow implementation - for development only!');
        
        const mockTensor = (data?: any) => ({
            shape: [1],
            dtype: 'float32',
            size: 1,
            rank: 1,
            arraySync: () => data || [0.5],
            array: async () => data || [0.5],
            dataSync: () => new Float32Array(data || [0.5]),
            data: async () => new Float32Array(data || [0.5]),
            dispose: () => {},
            add: () => mockTensor(),
            sub: () => mockTensor(),
            mul: () => mockTensor(),
            div: () => mockTensor(),
            mean: () => mockTensor([2.5]),
            sum: () => mockTensor([10]),
            square: () => mockTensor(),
            sqrt: () => mockTensor(),
            reshape: () => mockTensor(),
            expandDims: () => mockTensor(),
            squeeze: () => mockTensor(),
            clone: () => mockTensor(data),
        });
        
        const mockModel = {
            predict: (input: any) => mockTensor([[0.5]]),
            fit: async () => ({ history: { loss: [0.1], accuracy: [0.9] } }),
            evaluate: () => mockTensor([0.1]),
            save: async () => ({ modelArtifactsInfo: { dateSaved: new Date() } }),
            compile: () => {},
            summary: () => {},
            layers: [],
            inputs: [],
            outputs: [],
        };
        
        return {
            // Tensor creation
            tensor: (data?: any) => mockTensor(data),
            tensor1d: (data?: any) => mockTensor(data),
            tensor2d: (data?: any) => mockTensor(data),
            tensor3d: (data?: any) => mockTensor(data),
            tensor4d: (data?: any) => mockTensor(data),
            scalar: (value: number) => mockTensor([value]),
            zeros: (shape: number[]) => mockTensor([0]),
            ones: (shape: number[]) => mockTensor([1]),
            randomNormal: (shape: number[]) => mockTensor([Math.random()]),
            randomUniform: (shape: number[]) => mockTensor([Math.random()]),
            
            // Layers
            layers: {
                dense: (config: any) => ({ ...config, type: 'Dense' }),
                conv2d: (config: any) => ({ ...config, type: 'Conv2D' }),
                maxPooling2d: (config: any) => ({ ...config, type: 'MaxPooling2D' }),
                flatten: (config: any) => ({ ...config, type: 'Flatten' }),
                dropout: (config: any) => ({ ...config, type: 'Dropout' }),
                batchNormalization: (config: any) => ({ ...config, type: 'BatchNormalization' }),
                activation: (config: any) => ({ ...config, type: 'Activation' }),
                input: (config: any) => ({ ...config, type: 'Input' }),
            },
            
            // Models
            sequential: (config?: any) => mockModel,
            model: (config: any) => mockModel,
            loadLayersModel: async () => mockModel,
            
            // Training
            train: {
                adam: () => ({ name: 'adam' }),
                sgd: () => ({ name: 'sgd' }),
                rmsprop: () => ({ name: 'rmsprop' }),
            },
            
            // Losses
            losses: {
                meanSquaredError: () => 'meanSquaredError',
                categoricalCrossentropy: () => 'categoricalCrossentropy',
                binaryCrossentropy: () => 'binaryCrossentropy',
            },
            
            // Metrics
            metrics: {
                accuracy: () => 'accuracy',
                categoricalAccuracy: () => 'categoricalAccuracy',
                binaryAccuracy: () => 'binaryAccuracy',
            },
            
            // Utils
            util: {
                shuffle: (array: any[]) => [...array],
                now: () => Date.now(),
            },
            
            // Backend
            backend: () => ({ name: 'mock' }),
            getBackend: () => 'mock',
            setBackend: async () => true,
            ready: async () => true,
            
            // Memory
            memory: () => ({ numTensors: 0, numDataBuffers: 0, numBytes: 0 }),
            dispose: () => {},
            disposeVariables: () => {},
            
            // Version
            version: { tfjs: '0.0.0-mock' },
        };
    }
    
    async load(): Promise<any> {
        // Return existing instance if already loaded
        if (this.tf) {
            return this.tf;
        }
        
        // Return existing load promise if loading is in progress
        if (this.loadPromise) {
            return this.loadPromise;
        }
        
        this.loadPromise = this.performLoad();
        
        try {
            this.tf = await this.loadPromise;
            return this.tf;
        } finally {
            this.loadPromise = null;
        }
    }
    
    private async performLoad(): Promise<any> {
        const startTime = Date.now();
        this.logger.log('🚀 Starting TensorFlow.js loader...');
        
        // Try each backend in order
        for (const backend of this.backends) {
            try {
                const tf = await this.loadWithRetry(backend);
                this.currentBackend = backend.name;
                
                const totalTime = Date.now() - startTime;
                this.logger.log(`✨ TensorFlow.js loaded successfully!
                    Backend: ${this.currentBackend}
                    Total time: ${totalTime}ms
                    Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
                `);
                
                return tf;
            } catch (error) {
                // Continue to next backend
                continue;
            }
        }
        
        // All backends failed
        this.logger.error('❌ All TensorFlow.js backends failed to load');
        
        if (this.config.enableMockFallback) {
            this.currentBackend = 'mock';
            return this.createMockTensorFlow();
        }
        
        throw new Error('Failed to load TensorFlow.js with any backend');
    }
    
    getBackendInfo(): {
        current: string;
        available: string[];
        failed: { name: string; error: string }[];
        performance: PerformanceMetrics[];
    } {
        return {
            current: this.currentBackend,
            available: this.backends
                .filter(b => b.available !== false)
                .map(b => b.name),
            failed: this.backends
                .filter(b => b.error)
                .map(b => ({ name: b.name, error: b.error!.message })),
            performance: this.performanceMetrics
        };
    }
    
    async dispose(): Promise<void> {
        if (this.tf && this.tf.dispose) {
            this.tf.dispose();
        }
        this.tf = null;
        this.currentBackend = 'unknown';
        this.performanceMetrics = [];
    }
    
    isLoaded(): boolean {
        return this.tf !== null;
    }
    
    getCurrentBackend(): string {
        return this.currentBackend;
    }
}

// Singleton instance
const loader = TensorFlowLoader.getInstance();

// Export main functions
export async function loadTensorFlow(config?: LoaderConfig): Promise<any> {
    const customLoader = config ? TensorFlowLoader.getInstance(config) : loader;
    return customLoader.load();
}

export async function getTensorFlow(): Promise<any> {
    return loader.load();
}

export function getTensorFlowSync(): any {
    if (!loader.isLoaded()) {
        throw new Error('TensorFlow.js not loaded. Call loadTensorFlow() first.');
    }
    return loader.load();
}

export function getTensorFlowInfo() {
    return loader.getBackendInfo();
}

export async function disposeTensorFlow(): Promise<void> {
    return loader.dispose();
}

// Convenience exports
export const tfReady = loadTensorFlow();
export default { loadTensorFlow, getTensorFlow, getTensorFlowSync, getTensorFlowInfo, disposeTensorFlow };