import * as tf from '@tensorflow/tfjs';
// For GPU acceleration in Node, import '@tensorflow/tfjs-node' instead.

/**
 * Ultra-Advanced DDPG Agent implementation
 * ------------------------------------------------
 * Features:
 * - Layer Normalization
 * - L2 Weight Regularization
 * - Prioritized Experience Replay
 * - Ornstein–Uhlenbeck Exploration Noise
 * - Gradient Clipping
 * - TensorBoard-Style Metric Logging (placeholder)
 * - Model Persistence (Save & Load)
 * - Memory Management via tf.tidy
 * - Robust Error Handling & Custom Logging
 */

interface DDPGOptions {
    stateDim: number;
    actionDim: number;
    maxAction: number;
    actorLearningRate: number;
    criticLearningRate: number;
    tau: number;                // Soft update coefficient
    gamma: number;              // Discount factor
    bufferSize?: number;        // Replay buffer size
    batchSize?: number;         // Batch size for training
    ouTheta?: number;           // OU noise theta
    ouSigma?: number;           // OU noise sigma
    l2RegActor?: number;        // L2 regularization actor
    l2RegCritic?: number;       // L2 regularization critic
    gradClip?: number;          // Gradient clipping threshold
    logInterval?: number;       // Steps between logging
}

// Simple console-based logger
class Logger {
    constructor(private prefix = 'DDPG') { }
    info(msg: string) { console.log(`[INFO][${this.prefix}] ${msg}`); }
    warn(msg: string) { console.warn(`[WARN][${this.prefix}] ${msg}`); }
    error(msg: string) { console.error(`[ERROR][${this.prefix}] ${msg}`); }
}

// Prioritized Experience Replay Buffer
class PrioritizedReplayBuffer {
    private buffer: any[] = [];
    private priorities: number[] = [];
    private maxSize: number;
    private alpha = 0.6;
    private beta = 0.4;
    private eps = 1e-6;

    constructor(maxSize: number = 1e6) {
        this.maxSize = maxSize;
    }

    add(exp: any) {
        try {
            if (this.buffer.length >= this.maxSize) {
                this.buffer.shift(); this.priorities.shift();
            }
            this.buffer.push(exp);
            this.priorities.push(Math.max(...this.priorities, 1));
        } catch (err) {
            console.error('[ReplayBuffer][add]', err);
        }
    }

    sample(batchSize: number) {
        try {
            const prios = this.priorities.map(p => Math.pow(p + this.eps, this.alpha));
            const sum = prios.reduce((a, b) => a + b, 0);
            const probs = prios.map(p => p / sum);
            const inds: number[] = [];
            for (let i = 0; i < batchSize; i++) {
                const r = Math.random(); let cum = 0;
                for (let j = 0; j < probs.length; j++) {
                    cum += probs[j];
                    if (r <= cum) { inds.push(j); break; }
                }
            }
            const weights = inds.map(i => Math.pow(this.buffer.length * probs[i], -this.beta));
            const maxW = Math.max(...weights);
            const normW = weights.map(w => w / maxW);
            return inds.map((i, idx) => ({ index: i, weight: normW[idx], data: this.buffer[i] }));
        } catch (err) {
            console.error('[ReplayBuffer][sample]', err);
            return [];
        }
    }

    update(indices: number[], errors: number[]) {
        try {
            indices.forEach((i, idx) => {
                this.priorities[i] = Math.abs(errors[idx]) + this.eps;
            });
        } catch (err) {
            console.error('[ReplayBuffer][update]', err);
        }
    }

    size() { return this.buffer.length; }
}

// Ornstein–Uhlenbeck Noise for exploration
class OrnsteinUhlenbeckNoise {
    private state: tf.Tensor1D;
    constructor(private dim: number, private theta = 0.15, private sigma = 0.2) {
        this.state = tf.zeros([dim]);
    }
    sample() {
        return tf.tidy(() => {
            const dx = this.state.mul(-this.theta)
                .add(tf.randomNormal([this.dim], 0, this.sigma));
            this.state = this.state.add(dx) as tf.Tensor1D;
            return this.state;
        });
    }
    reset() { this.state.dispose(); this.state = tf.zeros([this.dim]); }
}

export class DDPGAgent {
    private actor: tf.LayersModel;
    private critic: tf.LayersModel;
    private targetActor: tf.LayersModel;
    private targetCritic: tf.LayersModel;
    private actorOpt: tf.Optimizer;
    private criticOpt: tf.Optimizer;
    private buffer: PrioritizedReplayBuffer;
    private noise: OrnsteinUhlenbeckNoise;
    private logger = new Logger();
    private step = 0;

    constructor(private opts: DDPGOptions) {
        opts.bufferSize = opts.bufferSize || 1e6;
        opts.batchSize = opts.batchSize || 64;
        opts.ouTheta = opts.ouTheta || 0.15;
        opts.ouSigma = opts.ouSigma || 0.2;
        opts.l2RegActor = opts.l2RegActor || 1e-4;
        opts.l2RegCritic = opts.l2RegCritic || 1e-3;
        opts.gradClip = opts.gradClip || 0.5;
        opts.logInterval = opts.logInterval || 100;

        this.actor = this.buildActor();
        this.critic = this.buildCritic();
        this.targetActor = this.buildActor();
        this.targetCritic = this.buildCritic();
        this.softUpdate(this.actor, this.targetActor, 1.0);
        this.softUpdate(this.critic, this.targetCritic, 1.0);

        this.actorOpt = tf.train.adam(opts.actorLearningRate);
        this.criticOpt = tf.train.adam(opts.criticLearningRate);

        this.buffer = new PrioritizedReplayBuffer(opts.bufferSize);
        this.noise = new OrnsteinUhlenbeckNoise(opts.actionDim, opts.ouTheta, opts.ouSigma);

        this.logger.info('Initialized DDPGAgent');
    }

    private buildActor(): tf.LayersModel {
        const stateIn = tf.input({ shape: [this.opts.stateDim] });
        let x = tf.layers.dense({
            units: 400, activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: this.opts.l2RegActor! })
        }).apply(stateIn) as tf.SymbolicTensor;

        x = tf.layers.layerNormalization().apply(x) as tf.SymbolicTensor;
        x = tf.layers.dense({ units: 300, activation: 'relu' }).apply(x) as tf.SymbolicTensor;

        const output = tf.layers.dense({ units: this.opts.actionDim, activation: 'tanh' })
            .apply(x) as tf.SymbolicTensor;
        return tf.model({ inputs: stateIn, outputs: output });
    }

    private buildCritic(): tf.LayersModel {
        const stateIn = tf.input({ shape: [this.opts.stateDim] });
        const actionIn = tf.input({ shape: [this.opts.actionDim] });

        let x = tf.layers.concatenate().apply([stateIn, actionIn]) as tf.SymbolicTensor;

        x = tf.layers.dense({
            units: 400, activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: this.opts.l2RegCritic! })
        }).apply(x) as tf.SymbolicTensor;
        x = tf.layers.layerNormalization().apply(x) as tf.SymbolicTensor;
        x = tf.layers.dense({ units: 300, activation: 'relu' }).apply(x) as tf.SymbolicTensor;

        const qVal = tf.layers.dense({ units: 1 }).apply(x) as tf.SymbolicTensor;

        return tf.model({ inputs: [stateIn, actionIn], outputs: qVal });
    }

    async selectAction(state: number[]): Promise<number[]> {
        try {
            return tf.tidy(() => {
                const st = tf.tensor2d([state]);
                const raw = this.actor.predict(st) as tf.Tensor;
                const noise = this.noise.sample();
                const noisy = raw.add(noise).clipByValue(-1, 1).mul(tf.scalar(this.opts.maxAction));

                return Array.from((noisy.dataSync() as Float32Array));
            });
        } catch (err) {
            this.logger.error(`selectAction failed: ${err}`);
            return Array(this.opts.actionDim).fill(0);
        }
    }

    store(exp: { state: number[]; action: number[]; reward: number; nextState: number[]; done: boolean }) {
        this.buffer.add(exp);
    }

    
    async train() {
        if (this.buffer.size() < this.opts.batchSize!) return;
        try {
            const batch = this.buffer.sample(this.opts.batchSize!);
            const states = tf.tensor2d(batch.map(b => b.data.state));
            const actions = tf.tensor2d(batch.map(b => b.data.action));
            const rewards = tf.tensor2d(batch.map(b => [b.data.reward]));
            const nextStates = tf.tensor2d(batch.map(b => b.data.nextState));
            const dones = tf.tensor2d(batch.map(b => [b.data.done ? 0 : 1]));
            const isWeights = tf.tensor2d(batch.map(b => [b.weight]));

            // Critic update
            const { grads: criticGrads } = tf.variableGrads(() => {
                const nextA = this.targetActor.predict(nextStates) as tf.Tensor;
                const targetQ = this.targetCritic.predict([nextStates, nextA]) as tf.Tensor;
                const y = rewards.add(targetQ.mul(this.opts.gamma).mul(dones));
                const currQ = this.critic.predict([states, actions]) as tf.Tensor;
                const tdErr = y.sub(currQ);
                const loss = tdErr.square().mul(isWeights).mean() as tf.Scalar;
                this.buffer.update(batch.map(b => b.index), Array.from(tdErr.abs().dataSync()));
                return loss;
            });
            Object.values(criticGrads).forEach(g => g.clipByValue(-this.opts.gradClip!, this.opts.gradClip!));
            (this.criticOpt as tf.Optimizer).applyGradients(criticGrads);

            // Actor update
            const { grads: actorGrads } = tf.variableGrads(() => {
                const preds = this.actor.predict(states) as tf.Tensor;
                const qVal = this.critic.predict([states, preds]) as tf.Tensor;
                return (qVal.neg().mean() as tf.Scalar);
            });
            Object.values(actorGrads).forEach(g => g.clipByValue(-this.opts.gradClip!, this.opts.gradClip!));
            (this.actorOpt as tf.Optimizer).applyGradients(actorGrads);

            this.step++;
            if (this.step % this.opts.logInterval! === 0) {
                this.logger.info(`Step ${this.step} completed`);
            }

            // Soft update targets
            this.softUpdate(this.actor, this.targetActor, this.opts.tau);
            this.softUpdate(this.critic, this.targetCritic, this.opts.tau);

            // Dispose intermediate tensors
            tf.dispose([states, actions, rewards, nextStates, dones, isWeights]);
        } catch (err) {
            this.logger.error(`train step failed: ${err}`);
        }
    }

    private softUpdate(src: tf.LayersModel, tgt: tf.LayersModel, tau: number) {
        tf.tidy(() => {
            const sw = src.getWeights();
            const tw = tgt.getWeights();
            const nw = sw.map((w, i) => w.mul(tau).add(tw[i].mul(1 - tau)));
            tgt.setWeights(nw);
        });
    }

    async save(path: string) {
        try {
            await this.actor.save(`file://${path}/actor`);
            await this.critic.save(`file://${path}/critic`);
            this.logger.info(`Models saved to ${path}`);
        } catch (err) {
            this.logger.error(`save failed: ${err}`);
        }
    }

    async load(path: string) {
        try {
            this.actor = await tf.loadLayersModel(`file://${path}/actor/model.json`);
            this.critic = await tf.loadLayersModel(`file://${path}/critic/model.json`);
            this.logger.info(`Models loaded from ${path}`);
        } catch (err) {
            this.logger.error(`load failed: ${err}`);
        }
    }

    dispose() {
        this.actor.dispose();
        this.critic.dispose();
        this.targetActor.dispose();
        this.targetCritic.dispose();
        this.logger.info('Disposed all model resources');
    }
}
