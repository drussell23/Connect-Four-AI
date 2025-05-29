import * as tf from '@tensorflow/tfjs';

/**
 * AlphaZero agent for discrete Connect-Four.
 * Combines a Residual Policy-Value network with PUCT-based MCTS.
 * Uses pure TFJS backend (WASM/CPU), no native dependencies.
 */

// === Constants & Types ===
export type CellValue = 'Empty' | 'Red' | 'Yellow';
export const BOARD_ROWS = 6;
export const BOARD_COLS = 7;
export const ACTION_SIZE = BOARD_COLS;
export const STATE_SHAPE: [number, number, number] = [BOARD_ROWS, BOARD_COLS, 2];

// Self-play example: state, policy target, value target
export interface Example {
    state: tf.Tensor3D;      // [rows, cols, channels]
    policy: number[];        // length ACTION_SIZE
    value: number;           // -1..1
}

// MCTS tree node
class MCTSNode {
    parent: MCTSNode | null;
    children: Map<number, MCTSNode> = new Map();
    prior: number;
    visitCount = 0;
    valueSum = 0;

    constructor(public state: CellValue[][], prior: number, parent: MCTSNode | null = null) {
        this.prior = prior;
        this.parent = parent;
    }

    get value(): number {
        return this.visitCount === 0 ? 0 : this.valueSum / this.visitCount;
    }
}

// Residual block
function resBlock(x: tf.SymbolicTensor, filters: number): tf.SymbolicTensor {
    const init = tf.initializers.heNormal({});
    let y = tf.layers.conv2d({ filters, kernelSize: 3, padding: 'same', kernelInitializer: init, useBias: false }).apply(x) as tf.SymbolicTensor;
    y = tf.layers.batchNormalization({ axis: -1 }).apply(y) as tf.SymbolicTensor;
    y = tf.layers.activation({ activation: 'relu' }).apply(y) as tf.SymbolicTensor;
    y = tf.layers.conv2d({ filters, kernelSize: 3, padding: 'same', kernelInitializer: init, useBias: false }).apply(y) as tf.SymbolicTensor;
    y = tf.layers.batchNormalization({ axis: -1 }).apply(y) as tf.SymbolicTensor;
    const out = tf.layers.add().apply([x, y]) as tf.SymbolicTensor;
    return tf.layers.activation({ activation: 'relu' }).apply(out) as tf.SymbolicTensor;
}

// Policy-Value Network
export class PVNetwork {
    model: tf.LayersModel;

    constructor(resBlocks = 5, lr = 1e-3) {
        this.model = this.buildNetwork(resBlocks);
        this.model.compile({
            optimizer: tf.train.adam(lr),
            loss: {
                policy: 'categoricalCrossentropy',
                value: 'meanSquaredError'
            }
            // no lossWeights property
        });
        console.info(`PVNetwork: Created with ${resBlocks} residual blocks`);
    }

    private buildNetwork(resBlocks: number): tf.LayersModel {
        const init = tf.initializers.heNormal({});
        const input = tf.input({ shape: STATE_SHAPE });
        let x = tf.layers.conv2d({ filters: 64, kernelSize: 3, padding: 'same', activation: 'relu', kernelInitializer: init }).apply(input) as tf.SymbolicTensor;

        for (let i = 0; i < resBlocks; i++) {
            x = resBlock(x, 64);
        }

        const flat = tf.layers.flatten().apply(x) as tf.SymbolicTensor;

        // Policy head
        let p = tf.layers.dense({ units: 256, activation: 'relu', kernelInitializer: init }).apply(flat) as tf.SymbolicTensor;
        p = tf.layers.dense({ name: 'policy', units: ACTION_SIZE, activation: 'softmax', kernelInitializer: init }).apply(p) as tf.SymbolicTensor;

        // Value head
        let v = tf.layers.dense({ units: 256, activation: 'relu', kernelInitializer: init }).apply(flat) as tf.SymbolicTensor;
        v = tf.layers.dense({ name: 'value', units: 1, activation: 'tanh', kernelInitializer: init }).apply(v) as tf.SymbolicTensor;

        return tf.model({ inputs: input, outputs: [p, v] });
    }

    predict(state: tf.Tensor3D): { policy: tf.Tensor1D; value: tf.Scalar } {
        return tf.tidy(() => {
            const batched = state.expandDims(0); // [1, r, c, ch]
            const [p, v] = this.model.predict(batched) as [tf.Tensor2D, tf.Tensor2D];
            const policy = p.squeeze([0]) as tf.Tensor1D;
            const value = v.squeeze([0, 1]) as tf.Scalar;
            return { policy, value };
        });
    }

    async train(examples: Example[], epochs = 1, batchSize = 32) {
        const states = tf.stack(examples.map(e => e.state)) as tf.Tensor4D;
        const policyTargets = examples.map(e => e.policy);
        const valueTargets = examples.map(e => [e.value]);

        const policies = tf.tensor2d(policyTargets, [policyTargets.length, ACTION_SIZE]) as tf.Tensor2D;
        const values = tf.tensor2d(valueTargets, [valueTargets.length, 1]) as tf.Tensor2D;

        console.info(`Training on ${examples.length} examples`);
        await this.model.fit(states, { policy: policies, value: values }, { epochs, batchSize });
        tf.dispose([states, policies, values]);
    }

    async save(path: string) {
        await this.model.save(`file://${path}`);
        console.info(`PVNetwork saved to ${path}`);
    }

    async load(path: string) {
        this.model = await tf.loadLayersModel(`file://${path}/model.json`);
        console.info(`PVNetwork loaded from ${path}`);
    }
}

// MCTS with PUCT and Dirichlet noise
export class MCTS {
    private root: MCTSNode;
    private alpha = 0.03;    // Dirichlet noise alpha
    private epsilon = 0.25;  // mix ratio
    private cpuct = 1.0;     // exploration constant

    constructor(private network: PVNetwork, private simulations = 800) { }

    search(rootState: CellValue[][]): number[] {
        this.root = new MCTSNode(rootState, 1.0, null);

        // Expand root + add noise
        this.expand(this.root);
        const priors = Array.from(this.root.children.values()).map(c => c.prior);
        const noise = tf.randomGamma([priors.length], this.alpha, 1).arraySync() as number[];
        const noiseSum = noise.reduce((a, b) => a + b, 0);
        let idx = 0;
        for (const child of this.root.children.values()) {
            child.prior = (1 - this.epsilon) * child.prior + this.epsilon * (noise[idx++] / noiseSum);
        }

        // Simulations
        for (let i = 0; i < this.simulations; i++) {
            let node = this.root;
            const path: MCTSNode[] = [node];

            // Selection
            while (node.children.size && node.visitCount > 0) {
                node = this.select(node);
                path.push(node);
            }

            // Evaluation
            const leaf = path[path.length - 1];
            const { value } = this.network.predict(this.stateToTensor(leaf.state));
            this.expand(leaf);

            // Backup
            const v = value.dataSync()[0];
            for (const nd of path) {
                nd.visitCount++;
                nd.valueSum += v;
            }
            value.dispose();
        }

        // Build policy from visit counts
        const visits = Array.from(this.root.children.values()).map(c => c.visitCount);
        const total = visits.reduce((a, b) => a + b, 0);
        const policy: number[] = Array(ACTION_SIZE).fill(0);
        for (const [action, child] of this.root.children.entries()) {
            policy[action] = child.visitCount / total;
        }
        return policy;
    }

    private expand(node: MCTSNode) {
        const legal = this.getLegalMoves(node.state);
        const { policy } = this.network.predict(this.stateToTensor(node.state));
        const probs = policy.arraySync() as number[];
        policy.dispose();
        for (const a of legal) {
            node.children.set(a, new MCTSNode(this.tryAction(node.state, a), probs[a], node));
        }
    }

    private select(node: MCTSNode): MCTSNode {
        let bestScore = -Infinity;
        let best: MCTSNode | null = null;
        const sqrtN = Math.sqrt(node.visitCount || 1);
        for (const child of node.children.values()) {
            const u = this.cpuct * child.prior * sqrtN / (1 + child.visitCount);
            const score = child.value + u;
            if (score > bestScore) { bestScore = score; best = child; }
        }
        return best!;
    }

    private stateToTensor(state: CellValue[][]): tf.Tensor3D {
        const redPlane = state.map(row => row.map(v => (v === 'Red' ? 1 : 0)));
        const yellowPlane = state.map(row => row.map(v => (v === 'Yellow' ? 1 : 0)));
        const redT = tf.tensor(redPlane).expandDims(-1);
        const yellowT = tf.tensor(yellowPlane).expandDims(-1);
        const stacked = tf.concat([redT, yellowT], -1) as tf.Tensor3D;
        redT.dispose(); yellowT.dispose();
        return stacked;
    }

    private getLegalMoves(board: CellValue[][]): number[] {
        const moves: number[] = [];
        for (let c = 0; c < BOARD_COLS; c++) if (board[0][c] === 'Empty') moves.push(c);
        return moves;
    }

    private tryAction(board: CellValue[][], action: number): CellValue[][] {
        const next = board.map(r => [...r]);
        for (let r = BOARD_ROWS - 1; r >= 0; r--) {
            if (next[r][action] === 'Empty') {
                next[r][action] = this.currentPlayer(board);
                break;
            }
        }
        return next;
    }

    private currentPlayer(board: CellValue[][]): CellValue {
        const flat = board.flat();
        const redCount = flat.filter(v => v === 'Red').length;
        const yelCount = flat.filter(v => v === 'Yellow').length;
        return redCount <= yelCount ? 'Red' : 'Yellow';
    }
}
