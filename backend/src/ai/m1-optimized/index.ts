/**
 * M1-Optimized AI Components for Connect Four
 * Export all M1-specific optimizations
 */

export * from './tensorflow-webgpu-init';
export * from './parallel-ai-worker';
export * from './parallel-ai-orchestrator';
export * from './webgpu-optimized-cnn';
export * from './enhanced-async-orchestrator';
export * from './m1-performance-optimizer';
export * from './tensorflow-memory-manager';
export * from './adaptive-replay-buffer';
export * from './adaptive-cache-manager';
export * from './m1-ai-config.service';
export * from './m1-optimized-ai.module';
export * from './m1-optimized-ai.service';

// Re-export types
export type { WorkerTask, WorkerResult } from './parallel-ai-worker';
export type { ParallelComputeRequest, ParallelComputeResult } from './parallel-ai-orchestrator';
export type { WebGPUNetworkConfig, BatchPrediction } from './webgpu-optimized-cnn';
export type { M1OptimizationConfig } from './tensorflow-webgpu-init';

// Re-export commonly used instances and factories
export { m1Optimizer } from './m1-performance-optimizer';
export { tfMemory } from './tensorflow-memory-manager';
export { createAdaptiveBuffer } from './adaptive-replay-buffer';
export { CacheFactory } from './adaptive-cache-manager';
export { M1_PRESETS } from './m1-ai-config.service';