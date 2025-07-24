/**
 * Mock TensorFlow.js module for development
 * In production, install @tensorflow/tfjs-node and use the real module
 */

export interface Tensor {
  dispose(): void;
  array(): Promise<any>;
}

export interface Tensor2D extends Tensor {}

export interface LayersModel {
  predict(inputs: Tensor): Tensor;
  fit(x: Tensor, y: Tensor, config?: any): Promise<{ history: { loss: number[] } }>;
  compile(config: any): void;
  save(path: string): Promise<void>;
}

export interface Sequential extends LayersModel {}

// Export as namespace for type declarations
export namespace tf {
  export interface Tensor {
    dispose(): void;
    array(): Promise<any>;
  }
  
  export interface Tensor2D extends Tensor {}
  
  export interface LayersModel {
    predict(inputs: Tensor): Tensor;
    fit(x: Tensor, y: Tensor, config?: any): Promise<{ history: { loss: number[] } }>;
    compile(config: any): void;
    save(path: string): Promise<void>;
  }
}

class MockTensor implements Tensor {
  constructor(private data: any, private shape?: number[]) {}
  
  dispose(): void {
    // Mock cleanup
  }
  
  async array(): Promise<any> {
    return this.data;
  }
}

class MockModel implements LayersModel {
  predict(inputs: Tensor): Tensor {
    // Return mock predictions
    const mockOutput = Array(7).fill(0).map(() => Math.random());
    return new MockTensor([mockOutput]);
  }
  
  async fit(x: Tensor, y: Tensor, config?: any): Promise<{ history: { loss: number[] } }> {
    // Mock training
    return {
      history: {
        loss: [0.1, 0.08, 0.06, 0.05, 0.04]
      }
    };
  }
  
  compile(config: any): void {
    // Mock compilation
  }
  
  async save(path: string): Promise<void> {
    // Mock save
  }
}

// Mock TensorFlow API
const tf = {
  tensor2d: (data: number[][], shape?: number[]): Tensor2D => {
    return new MockTensor(data, shape) as Tensor2D;
  },
  
  sequential: (config?: any): Sequential => {
    return new MockModel() as Sequential;
  },
  
  loadLayersModel: async (path: string): Promise<LayersModel> => {
    throw new Error('Model not found - will create new');
  },
  
  layers: {
    dense: (config: any) => ({}),
    dropout: (config: any) => ({}),
    batchNormalization: (config?: any) => ({})
  },
  
  train: {
    adam: (learningRate: number) => ({})
  }
};

export default tf;