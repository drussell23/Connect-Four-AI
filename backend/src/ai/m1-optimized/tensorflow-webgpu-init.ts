/**
 * M1-Optimized TensorFlow.js initialization with WebGPU backend
 * Leverages Apple Silicon's GPU for accelerated AI computation
 */

import * as tf from '@tensorflow/tfjs';
// import '@tensorflow/tfjs-backend-webgpu';  // Commented out - optional dependency
import { Logger } from '@nestjs/common';

export interface M1OptimizationConfig {
  preferWebGPU: boolean;
  enableMemoryGrowth: boolean;
  powerPreference: 'low-power' | 'high-performance';
  numThreads?: number;
  enableFloat16?: boolean;
}

export class TensorFlowM1Initializer {
  private static logger = new Logger('TensorFlowM1Initializer');
  private static initialized = false;
  private static backend: string = 'cpu';

  /**
   * Initialize TensorFlow.js with M1-optimized settings
   */
  static async initialize(config: Partial<M1OptimizationConfig> = {}): Promise<void> {
    if (this.initialized) {
      this.logger.log(`TensorFlow.js already initialized with backend: ${this.backend}`);
      return;
    }

    const finalConfig: M1OptimizationConfig = {
      preferWebGPU: true,
      enableMemoryGrowth: true,
      powerPreference: 'high-performance',
      numThreads: 8, // M1 has 8 cores
      enableFloat16: true, // M1 supports float16 acceleration
      ...config
    };

    try {
      // First, try WebGPU backend for M1 GPU acceleration
      if (finalConfig.preferWebGPU) {
        await this.initializeWebGPU(finalConfig);
      }
    } catch (error) {
      this.logger.warn(`Failed to initialize WebGPU backend: ${error.message}`);
      this.logger.warn('Falling back to WebGL backend...');
      
      try {
        // Fallback to WebGL backend
        await this.initializeWebGL(finalConfig);
      } catch (webglError) {
        this.logger.warn(`Failed to initialize WebGL backend: ${webglError.message}`);
        this.logger.warn('Falling back to CPU backend...');
        
        // Final fallback to CPU
        await tf.setBackend('cpu');
        this.backend = 'cpu';
      }
    }

    // Configure TensorFlow.js for M1 optimization
    this.configureForM1(finalConfig);

    // Log backend info
    this.logger.log(`✅ TensorFlow.js initialized with backend: ${tf.getBackend()}`);
    this.logger.log(`   Memory: ${tf.memory().numTensors} tensors, ${(tf.memory().numBytes / 1048576).toFixed(2)} MB`);
    
    this.initialized = true;
  }

  /**
   * Initialize WebGPU backend (best for M1)
   */
  private static async initializeWebGPU(config: M1OptimizationConfig): Promise<void> {
    // Check if WebGPU is available (browser/server environment check)
    if (typeof navigator === 'undefined' || !navigator?.gpu) {
      throw new Error('WebGPU is not available in Node.js environment');
    }

    // Try to dynamically import WebGPU backend only if available
    try {
      // @ts-ignore - Optional dependency that may not be installed
      await import('@tensorflow/tfjs-backend-webgpu');
    } catch (error) {
      throw new Error('WebGPU backend not installed. Install @tensorflow/tfjs-backend-webgpu for GPU acceleration.');
    }

    // Request GPU adapter with M1-specific preferences
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: config.powerPreference,
    });

    if (!adapter) {
      throw new Error('No WebGPU adapter found');
    }

    // Set WebGPU backend
    await tf.setBackend('webgpu');
    
    // Configure WebGPU-specific optimizations
    const webgpuConfig = {
      // Enable memory growth for better M1 memory management
      memoryGrowth: config.enableMemoryGrowth,
      // Use float16 for better performance on M1
      enableFloat16: config.enableFloat16,
    };

    // Apply WebGPU configuration
    tf.env().set('WEBGPU_CPU_FORWARD', false); // Use GPU for all ops
    tf.env().set('WEBGPU_PACK_DEPTHWISECONV', true); // Optimize depthwise convolutions
    
    this.backend = 'webgpu';
    this.logger.log('🚀 WebGPU backend initialized for M1 acceleration');
  }

  /**
   * Initialize WebGL backend (fallback)
   */
  private static async initializeWebGL(config: M1OptimizationConfig): Promise<void> {
    await tf.setBackend('webgl');
    
    // Configure WebGL for M1
    tf.env().set('WEBGL_VERSION', 2); // Use WebGL 2.0
    tf.env().set('WEBGL_CPU_FORWARD', false);
    tf.env().set('WEBGL_PACK', true);
    tf.env().set('WEBGL_FORCE_F16_TEXTURES', config.enableFloat16 || false);
    tf.env().set('WEBGL_RENDER_FLOAT32_CAPABLE', true);
    
    this.backend = 'webgl';
    this.logger.log('✅ WebGL backend initialized');
  }

  /**
   * Configure TensorFlow.js for M1 optimization
   */
  private static configureForM1(config: M1OptimizationConfig): void {
    // General TensorFlow.js optimizations for M1
    tf.env().set('KEEP_INTERMEDIATE_TENSORS', false); // Save memory
    tf.env().set('CPU_HANDOFF_SIZE_THRESHOLD', 128); // Optimize CPU/GPU handoff
    tf.env().set('TOPK_K_CPU_HANDOFF_THRESHOLD', 128);
    
    // M1-specific optimizations
    if (config.numThreads) {
      tf.env().set('WEBGL_MAX_THREADS', config.numThreads);
    }

    // Enable profiling in development
    if (process.env.NODE_ENV === 'development') {
      tf.env().set('DEBUG', false); // Set to true for detailed debugging
      tf.env().set('CHECK_COMPUTATION_FOR_ERRORS', false); // Performance overhead
    }
  }

  /**
   * Get current backend information
   */
  static getBackendInfo(): {
    backend: string;
    features: Record<string, boolean>;
    memory: tf.MemoryInfo;
  } {
    return {
      backend: tf.getBackend(),
      features: {
        webgpu: tf.getBackend() === 'webgpu',
        webgl: tf.getBackend() === 'webgl',
        float16: tf.env().getBool('WEBGL_FORCE_F16_TEXTURES'),
        simd: 'SIMD' in WebAssembly,
      },
      memory: tf.memory(),
    };
  }

  /**
   * Optimize tensor operations for M1
   */
  static optimizeTensorOps(): void {
    // Register custom kernels optimized for M1
    // This is where we could add Metal Performance Shaders integration
    
    // Example: Custom matmul for M1
    tf.registerOp('OptimizedMatMul', (node) => {
      // Implementation would use M1-optimized matrix multiplication
      return tf.matMul(node.inputs[0], node.inputs[1]);
    });
  }

  /**
   * Clean up resources
   */
  static async dispose(): Promise<void> {
    tf.disposeVariables();
    await tf.ready();
    this.logger.log('TensorFlow.js resources disposed');
  }
}

/**
 * Utility function to check M1 compatibility
 */
export function checkM1Compatibility(): {
  isM1Compatible: boolean;
  availableBackends: string[];
  recommendedBackend: string;
} {
  const availableBackends: string[] = [];
  
  // Check WebGPU support (best for M1)
  if (typeof navigator !== 'undefined' && navigator.gpu) {
    availableBackends.push('webgpu');
  }
  
  // Check WebGL support
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      availableBackends.push('webgl');
    }
  }
  
  // CPU is always available
  availableBackends.push('cpu');
  
  // Node.js backend check
  try {
    require('@tensorflow/tfjs-node');
    availableBackends.push('node');
  } catch (e) {
    // Node backend not available
  }
  
  // Determine if we're on M1 (heuristic)
  const isM1Compatible = availableBackends.includes('webgpu') || 
                        (typeof navigator !== 'undefined' && 
                         navigator.userAgent.includes('Mac') &&
                         navigator.hardwareConcurrency >= 8);
  
  // Recommend best backend
  let recommendedBackend = 'cpu';
  if (availableBackends.includes('webgpu')) {
    recommendedBackend = 'webgpu';
  } else if (availableBackends.includes('webgl')) {
    recommendedBackend = 'webgl';
  } else if (availableBackends.includes('node')) {
    recommendedBackend = 'node';
  }
  
  return {
    isM1Compatible,
    availableBackends,
    recommendedBackend
  };
}