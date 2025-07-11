// test/setup.ts
import 'reflect-metadata';

// Configure Jest environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Mock TensorFlow.js backend
jest.mock('@tensorflow/tfjs', () => ({
    ready: jest.fn().mockResolvedValue(true),
    setBackend: jest.fn().mockResolvedValue(true),
    tensor: jest.fn().mockReturnValue({
        dispose: jest.fn(),
        dataSync: jest.fn().mockReturnValue([0.5, 0.3, 0.2, 0.1, 0.4, 0.6, 0.7])
    }),
    sequential: jest.fn().mockReturnValue({
        add: jest.fn(),
        compile: jest.fn(),
        fit: jest.fn().mockResolvedValue({}),
        predict: jest.fn().mockReturnValue({
            dataSync: jest.fn().mockReturnValue([0.5, 0.3, 0.2, 0.1, 0.4, 0.6, 0.7])
        }),
        dispose: jest.fn()
    }),
    layers: {
        dense: jest.fn().mockReturnValue({}),
        conv2d: jest.fn().mockReturnValue({}),
        maxPooling2d: jest.fn().mockReturnValue({}),
        flatten: jest.fn().mockReturnValue({}),
        dropout: jest.fn().mockReturnValue({}),
        batchNormalization: jest.fn().mockReturnValue({})
    },
    train: {
        adam: jest.fn().mockReturnValue({})
    },
    losses: {
        meanSquaredError: 'meanSquaredError',
        sparseCategoricalCrossentropy: 'sparseCategoricalCrossentropy'
    },
    metrics: {
        meanAbsoluteError: 'meanAbsoluteError',
        accuracy: 'accuracy'
    },
    callbacks: {
        earlyStopping: jest.fn().mockReturnValue({})
    }
}));

// Set up test timeouts
jest.setTimeout(30000);

// Global test utilities
export const createMockBoard = (pattern: string = 'empty') => {
    switch (pattern) {
        case 'empty':
            return Array(6).fill(null).map(() => Array(7).fill('Empty'));
        case 'midgame':
            return [
                ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
                ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
                ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
                ['Empty', 'Empty', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty'],
                ['Empty', 'Red', 'Red', 'Red', 'Empty', 'Empty', 'Empty'],
                ['Yellow', 'Yellow', 'Red', 'Yellow', 'Yellow', 'Empty', 'Empty']
            ];
        case 'threat':
            return [
                ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
                ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
                ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
                ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
                ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
                ['Red', 'Red', 'Red', 'Empty', 'Empty', 'Empty', 'Empty']
            ];
        default:
            return Array(6).fill(null).map(() => Array(7).fill('Empty'));
    }
};

// Mock performance monitoring
global.performance = {
    now: jest.fn().mockReturnValue(Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn().mockReturnValue([]),
    getEntriesByType: jest.fn().mockReturnValue([]),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    toJSON: jest.fn()
} as any;

// Mock WebGL context for TensorFlow.js
(global as any).HTMLCanvasElement = class HTMLCanvasElement {
    getContext() {
        return {
            getExtension: () => null,
            getParameter: () => 0,
            createShader: () => null,
            shaderSource: () => { },
            compileShader: () => { },
            getShaderParameter: () => true,
            createProgram: () => null,
            attachShader: () => { },
            linkProgram: () => { },
            getProgramParameter: () => true,
            useProgram: () => { },
            createBuffer: () => null,
            bindBuffer: () => { },
            bufferData: () => { },
            enableVertexAttribArray: () => { },
            vertexAttribPointer: () => { },
            drawArrays: () => { },
            canvas: { width: 1, height: 1 }
        };
    }
}; 