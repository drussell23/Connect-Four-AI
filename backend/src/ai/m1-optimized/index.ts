/**
 * M1-Optimized AI Components for Connect Four
 * Export all M1-specific optimizations
 */

export * from './tensorflow-webgpu-init';
export * from './parallel-ai-worker';
export * from './parallel-ai-orchestrator';
export * from './webgpu-optimized-cnn';
export * from './enhanced-async-orchestrator';

// Re-export types
export type { WorkerTask, WorkerResult } from './parallel-ai-worker';
export type { ParallelComputeRequest, ParallelComputeResult } from './parallel-ai-orchestrator';
export type { WebGPUNetworkConfig, BatchPrediction } from './webgpu-optimized-cnn';
export type { M1OptimizationConfig } from './tensorflow-webgpu-init';