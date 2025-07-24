/**
 * TypeScript type definitions for TensorFlow mock
 */

declare namespace tf {
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
}

export = tf;
export as namespace tf;