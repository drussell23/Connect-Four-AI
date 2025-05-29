import * as tf from '@tensorflow/tfjs';

/**
 * Soft Actor-Critic (SAC) agent for discrete Connect-Four.
 * Pure TFJS backend (WASM or CPU) with no native bindings.
 */

// === Types & Constants ===
export type CellValue = 'Empty' | 'Red' | 'Yellow';
export const BOARD_ROWS = 6;
export const BOARD_COLS = 7;
export const ACTION_SIZE = BOARD_COLS;

// Single replay transition structure
interface Transition {
    state: tf.Tensor3D;     // [ROWS, COLS, 2]
    action: number;         // 0..ACTION_SIZE-1
    reward: number;
    nextState: tf.Tensor3D; // [ROWS, COLS, 2]
    done: boolean;
}

// === Replay Buffer ===
class ReplayBuffer {
    private buffer: Transition[] = [];
    constructor(private maxSize = 100000) { }

    push(transition: Transition) {
        if (this.buffer.length >= this.maxSize) {
            const old = this.buffer.shift();
            if (old) {
                old.state.dispose();
                old.nextState.dispose();
            }
        }
        this.buffer.push(transition);
    }

    sample(batchSize: number): Transition[] {
        const n = this.buffer.length;
        const count = Math.min(batchSize, n);
        const indices = tf.util.createShuffledIndices(n);

        const batch: Transition[] = [];
        for (let i = 0; i < count; i++) {
            batch.push(this.buffer[indices[i]]);
        }
        // Optional debug
        console.debug(`Sampled ${batch.length}/${n} transitions from replay buffer`);
        return batch;
    }

    size(): number {
        return this.buffer.length;
    }
}

// === SAC Agent ===
export class SACAgent {
    private actor: tf.LayersModel;
    private critic1: tf.LayersModel;
    private critic2: tf.LayersModel;
    private targetCritic1: tf.LayersModel;
    private targetCritic2: tf.LayersModel;
    private logAlpha: tf.Variable;
    private alphaOptimizer: tf.Optimizer;
    private actorOptimizer: tf.Optimizer;
    private criticOptimizer: tf.Optimizer;
    private replayBuffer = new ReplayBuffer();

    // Hyperparameters
    private gamma = 0.99;
    private tau = 0.005;
    private batchSize = 64;
    private lr = 3e-4;
    private targetEntropy = -Math.log(1 / ACTION_SIZE) * 0.98;

    constructor() {
        // Build networks
        this.actor = this.buildActor();
        this.critic1 = this.buildCritic();
        this.critic2 = this.buildCritic();
        this.targetCritic1 = this.buildCritic();
        this.targetCritic2 = this.buildCritic();
        this.targetCritic1.setWeights(this.critic1.getWeights());
        this.targetCritic2.setWeights(this.critic2.getWeights());

        // Entropy coefficient
        this.logAlpha = tf.variable(tf.scalar(0.0));
        this.alphaOptimizer = tf.train.adam(this.lr);

        // Actor & critic optimizers
        this.actorOptimizer = tf.train.adam(this.lr);
        this.criticOptimizer = tf.train.adam(this.lr);

        console.log('[SAC] initialized', { gamma: this.gamma, tau: this.tau, lr: this.lr });
    }

    // Actor network: state -> logits
    private buildActor(): tf.LayersModel {
        const inp = tf.input({ shape: [BOARD_ROWS, BOARD_COLS, 2] });
        const conv = tf.layers
            .conv2d({ filters: 32, kernelSize: 3, padding: 'same', activation: 'relu' })
            .apply(inp) as tf.SymbolicTensor;
        const flat = tf.layers.flatten().apply(conv) as tf.SymbolicTensor;
        const hid = tf.layers.dense({ units: 128, activation: 'relu' }).apply(flat) as tf.SymbolicTensor;
        const logits = tf.layers.dense({ units: ACTION_SIZE }).apply(hid) as tf.SymbolicTensor;
        return tf.model({ inputs: inp, outputs: logits });
    }

    // Critic network: (state, actionOneHot) -> Q-value
    private buildCritic(): tf.LayersModel {
        const sIn = tf.input({ shape: [BOARD_ROWS, BOARD_COLS, 2] });
        const aIn = tf.input({ shape: [ACTION_SIZE] });
        const conv = tf.layers
            .conv2d({ filters: 32, kernelSize: 3, padding: 'same', activation: 'relu' })
            .apply(sIn) as tf.SymbolicTensor;
        const flat = tf.layers.flatten().apply(conv) as tf.SymbolicTensor;
        const cat = tf.layers.concatenate().apply([flat, aIn]) as tf.SymbolicTensor;
        const hid = tf.layers.dense({ units: 128, activation: 'relu' }).apply(cat) as tf.SymbolicTensor;
        const q = tf.layers.dense({ units: 1 }).apply(hid) as tf.SymbolicTensor;
        return tf.model({ inputs: [sIn, aIn], outputs: q });
    }

    /** Select action: greedy or sampled */
    selectAction(state: tf.Tensor3D, deterministic = false): number {
        return tf.tidy(() => {
            const batched = state.expandDims(0); // [1,R,C,2]
            const logits = this.actor.predict(batched) as tf.Tensor2D;
            const probs = tf.softmax(logits);
            if (deterministic) {
                return probs.argMax(1).dataSync()[0];
            } else {
                return tf.multinomial(probs, 1, null, true).dataSync()[0];
            }
        });
    }

    /** Store a transition */
    storeTransition(s: tf.Tensor3D, a: number, r: number, s2: tf.Tensor3D, done: boolean) {
        this.replayBuffer.push({ state: s, action: a, reward: r, nextState: s2, done });
    }

    /** Perform one SAC update step */
    async update(): Promise<void> {
        if (this.replayBuffer.size() < this.batchSize) return;
        const batch = this.replayBuffer.sample(this.batchSize);

        // Prepare batched tensors
        const states = tf.stack(batch.map(t => t.state)) as tf.Tensor4D;
        const nextStates = tf.stack(batch.map(t => t.nextState)) as tf.Tensor4D;
        const actions = tf.oneHot(
            tf.tensor1d(batch.map(t => t.action), 'int32'),
            ACTION_SIZE,
            1,
            0
        ) as tf.Tensor2D;
        const rewards = tf.tensor2d(batch.map(t => [t.reward]));
        const notDones = tf.tensor2d(batch.map(t => [t.done ? 0 : 1]));
        const alpha = this.logAlpha.exp();

        // --- Critic update ---
        this.criticOptimizer.minimize(() => {
            const nextLogits = this.actor.predict(nextStates) as tf.Tensor2D;
            const nextProbs = tf.softmax(nextLogits);
            const nextLogp = tf.logSoftmax(nextLogits);
            const entropy = nextProbs.mul(nextLogp).sum(1, true).mul(-1);

            const tgtQ1 = this.targetCritic1.predict([nextStates, nextProbs]) as tf.Tensor2D;
            const tgtQ2 = this.targetCritic2.predict([nextStates, nextProbs]) as tf.Tensor2D;
            const minTgt = tf.minimum(tgtQ1, tgtQ2).sub(alpha.mul(entropy));
            const target = rewards.add(notDones.mul(minTgt.mul(this.gamma)));

            const q1 = this.critic1.predict([states, actions]) as tf.Tensor2D;
            const q2 = this.critic2.predict([states, actions]) as tf.Tensor2D;
            const loss1 = tf.losses.meanSquaredError(target, q1);
            const loss2 = tf.losses.meanSquaredError(target, q2);
            const totalLoss = loss1.add(loss2);
            console.log(`[SAC] Critic Losses: L1=${loss1.dataSync()[0].toFixed(3)}, L2=${loss2.dataSync()[0].toFixed(3)}`);
            return totalLoss as tf.Scalar;
        });

        // --- Actor update ---
        this.actorOptimizer.minimize(() => {
            const logits = this.actor.predict(states) as tf.Tensor2D;
            const probs = tf.softmax(logits);
            const logp = tf.logSoftmax(logits);
            const ent = probs.mul(logp).sum(1, true).mul(-1);
            const q1 = this.critic1.predict([states, probs]) as tf.Tensor2D;
            const q2 = this.critic2.predict([states, probs]) as tf.Tensor2D;
            const minQ = tf.minimum(q1, q2);
            const loss = alpha.mul(ent).sub(minQ).mean();
            console.log(`[SAC] Actor Loss: ${loss.dataSync()[0].toFixed(3)}`);
            return loss as tf.Scalar;
        });

        // --- Alpha update ---
        this.alphaOptimizer.minimize(() => {
            const logits = this.actor.predict(states) as tf.Tensor2D;
            const logp = tf.logSoftmax(logits);
            const entropy = tf.softmax(logits).mul(logp).sum(1).mul(-1).mean();
            const loss = this.logAlpha.exp().mul(entropy.sub(this.targetEntropy));
            console.log(`[SAC] Alpha Loss: ${loss.dataSync()[0].toFixed(3)}`);
            return loss as tf.Scalar;
        });

        // Soft-update target critics
        this.softUpdate(this.targetCritic1, this.critic1);
        this.softUpdate(this.targetCritic2, this.critic2);

        // Cleanup
        states.dispose();
        nextStates.dispose();
        actions.dispose();
        rewards.dispose();
        notDones.dispose();
    }

    // Polyak averaging for target networks
    private softUpdate(target: tf.LayersModel, source: tf.LayersModel) {
        const tW = target.getWeights();
        const sW = source.getWeights();
        const newW = tW.map((tw, i) => tw.mul(1 - this.tau).add(sW[i].mul(this.tau)));
        target.setWeights(newW);
    }

    /** Dispose all model resources */
    dispose() {
        this.actor.dispose();
        this.critic1.dispose();
        this.critic2.dispose();
        this.targetCritic1.dispose();
        this.targetCritic2.dispose();
        this.logAlpha.dispose();
    }
}
