/**
 * TypeScript ML Module
 * Integrates all TypeScript-native ML libraries into the AI system
 */

import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ONNXModelEngine } from './onnx-model-engine';
import { BrainNeuralNetwork } from './brain-neural-network';
import { ML5TransferLearning } from './ml5-transfer-learning';
import { UnifiedMLManager } from './unified-ml-manager';
import { ModelEnsembleVoting } from './model-ensemble-voting';
import { TypeScriptMLService } from './typescript-ml.service';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [
    ONNXModelEngine,
    BrainNeuralNetwork,
    ML5TransferLearning,
    UnifiedMLManager,
    ModelEnsembleVoting,
    TypeScriptMLService
  ],
  exports: [
    ONNXModelEngine,
    BrainNeuralNetwork,
    ML5TransferLearning,
    UnifiedMLManager,
    ModelEnsembleVoting,
    TypeScriptMLService
  ]
})
export class TypeScriptMLModule {}