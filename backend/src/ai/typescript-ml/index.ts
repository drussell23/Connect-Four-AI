/**
 * TypeScript ML Library Exports
 * Provides all ML components for Connect Four AI
 */

export * from './onnx-model-engine';
export * from './brain-neural-network';
export * from './ml5-transfer-learning';
export * from './unified-ml-manager';
export * from './model-ensemble-voting';

// Re-export commonly used types
export type {
  ONNXModelConfig,
  ModelPrediction,
  ModelEnsemblePrediction
} from './onnx-model-engine';

export type {
  BrainNetworkConfig,
  NetworkPrediction,
  TrainingData,
  TrainingMetrics
} from './brain-neural-network';

export type {
  TransferLearningConfig,
  TransferLearningPrediction,
  AugmentationOptions
} from './ml5-transfer-learning';

export type {
  UnifiedModelConfig,
  UnifiedPrediction,
  ModelPerformanceMetrics,
  EnsembleStrategy
} from './unified-ml-manager';

export type {
  EnsembleMember,
  VotingResult,
  EnsembleConfig,
  EnsemblePerformance
} from './model-ensemble-voting';