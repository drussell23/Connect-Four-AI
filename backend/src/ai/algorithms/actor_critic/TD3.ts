import * as tf from '@tensorflow/tfjs';

/**
 * Twin Delayed Deep Deterministic Policy Gradients (TD3) agent for Connect-Four.
 * Enhanced with convolutional front-end, residual blocks, custom initializers,
 * batch normalization, dropout regularization, and detailed logging.
 * Uses pure TFJS backend (WASM/CPU), no native dependencies.
 */

// === Types & Constants ===
export type CellValue = 'Empty' | 'Red' | 'Yellow';
export const BOARD_ROWS = 6;
export const BOARD_COLS = 7;
export const ACTION_SIZE = BOARD_COLS;
export const STATE_SHAPE: [number, number, number] = [BOARD_ROWS, BOARD_COLS, 2];

// Single replay transition
interface Transition {
  state: tf.Tensor3D;    // [rows, cols, channels]
  action: number;
  reward: number;
  nextState: tf.Tensor3D;
  done: boolean;
}

/** Circular replay buffer */
class ReplayBuffer {
  private buffer: Transition[] = [];
  constructor(private maxSize = 100000) {}

  push(t: Transition) {
    if (this.buffer.length >= this.maxSize) {
      const old = this.buffer.shift();
      old?.state.dispose();
      old?.nextState.dispose();
    }
    this.buffer.push(t);
  }

  sample(batchSize: number): Transition[] {
    const n = this.buffer.length;
    const count = Math.min(batchSize, n);
    const indices = tf.util.createShuffledIndices(n);
    const batch: Transition[] = [];
    for (let i = 0; i < count; i++) {
      batch.push(this.buffer[indices[i]]);
    }
    console.debug(`ReplayBuffer: sampled ${batch.length}/${n}`);
    return batch;
  }

  size(): number { return this.buffer.length; }
  clear() {
    this.buffer.forEach(t => { t.state.dispose(); t.nextState.dispose(); });
    this.buffer = [];
  }
}

/** TD3 Agent */
export class TD3Agent {
  private actor: tf.LayersModel;
  private actorTarget: tf.LayersModel;
  private critic1: tf.LayersModel;
  private critic2: tf.LayersModel;
  private criticTarget1: tf.LayersModel;
  private criticTarget2: tf.LayersModel;

  private replay: ReplayBuffer;
  private actorOpt: tf.Optimizer;
  private criticOpt: tf.Optimizer;
  private totalIt = 0;

  constructor(
    private gamma = 0.99,
    private tau = 0.005,
    private policyNoise = 0.2,
    private noiseClip = 0.5,
    private policyDelay = 2,
    actorLR = 1e-4,
    criticLR = 1e-3,
    bufferSize = 100000
  ) {
    this.replay = new ReplayBuffer(bufferSize);

    this.actor = this.buildActor();
    this.actorTarget = this.buildActor();
    this.softUpdate(this.actorTarget, this.actor, 1);

    this.critic1 = this.buildCritic();
    this.critic2 = this.buildCritic();
    this.criticTarget1 = this.buildCritic();
    this.criticTarget2 = this.buildCritic();
    this.softUpdate(this.criticTarget1, this.critic1, 1);
    this.softUpdate(this.criticTarget2, this.critic2, 1);

    this.actorOpt = tf.train.adam(actorLR);
    this.criticOpt = tf.train.adam(criticLR);
  }

  // Residual block with HeNormal initializer and BatchNorm
  private residualBlock(x: tf.SymbolicTensor, filters: number): tf.SymbolicTensor {
    const init = tf.initializers.heNormal({});
    const conv1 = tf.layers.conv2d({ filters, kernelSize: 3, padding: 'same', activation: 'relu', kernelInitializer: init }).apply(x) as tf.SymbolicTensor;
    const bn1 = tf.layers.batchNormalization({ axis: -1 }).apply(conv1) as tf.SymbolicTensor;
    const conv2 = tf.layers.conv2d({ filters, kernelSize: 3, padding: 'same', kernelInitializer: init }).apply(bn1) as tf.SymbolicTensor;
    const bn2 = tf.layers.batchNormalization({ axis: -1 }).apply(conv2) as tf.SymbolicTensor;
    const added = tf.layers.add().apply([x, bn2]) as tf.SymbolicTensor;
    return tf.layers.activation({ activation: 'relu' }).apply(added) as tf.SymbolicTensor;
  }

  // Build actor: Conv->Res->Dense->Dropout->Tanh
  private buildActor(): tf.LayersModel {
    const init = tf.initializers.heNormal({});
    const input = tf.input({ shape: STATE_SHAPE });
    let x = tf.layers.conv2d({ filters: 32, kernelSize: 3, padding: 'same', activation: 'relu', kernelInitializer: init }).apply(input) as tf.SymbolicTensor;
    x = this.residualBlock(x, 32);
    x = tf.layers.conv2d({ filters: 64, kernelSize: 3, padding: 'same', activation: 'relu', kernelInitializer: init }).apply(x) as tf.SymbolicTensor;
    x = this.residualBlock(x, 64);
    const flat = tf.layers.flatten().apply(x) as tf.SymbolicTensor;
    const h1 = tf.layers.dense({ units: 256, activation: 'relu', kernelInitializer: init }).apply(flat) as tf.SymbolicTensor;
    const drop = tf.layers.dropout({ rate: 0.1 }).apply(h1) as tf.SymbolicTensor;
    const out = tf.layers.dense({ units: ACTION_SIZE, activation: 'tanh', kernelInitializer: init, biasInitializer: tf.initializers.zeros() }).apply(drop) as tf.SymbolicTensor;
    return tf.model({ inputs: input, outputs: out });
  }

  // Build critic: Conv->Res->Dense concat action->Dense->Q-value
  private buildCritic(): tf.LayersModel {
    const init = tf.initializers.heNormal({});
    const sIn = tf.input({ shape: STATE_SHAPE });
    const aIn = tf.input({ shape: [ACTION_SIZE] });
    let xs = tf.layers.conv2d({ filters: 32, kernelSize: 3, padding: 'same', activation: 'relu', kernelInitializer: init }).apply(sIn) as tf.SymbolicTensor;
    xs = this.residualBlock(xs, 32);
    xs = tf.layers.flatten().apply(xs) as tf.SymbolicTensor;
    const concat = tf.layers.concatenate().apply([xs, aIn]) as tf.SymbolicTensor;
    const h1 = tf.layers.dense({ units: 256, activation: 'relu', kernelInitializer: init }).apply(concat) as tf.SymbolicTensor;
    const h2 = tf.layers.dense({ units: 256, activation: 'relu', kernelInitializer: init }).apply(h1) as tf.SymbolicTensor;
    const q = tf.layers.dense({ units: 1, kernelInitializer: init, useBias: true, biasInitializer: tf.initializers.zeros() }).apply(h2) as tf.SymbolicTensor;
    return tf.model({ inputs: [sIn, aIn], outputs: q });
  }

  // Soft update: target = τ*source + (1-τ)*target
  private softUpdate(target: tf.LayersModel, source: tf.LayersModel, tau: number) {
    const sw = source.getWeights();
    const tw = target.getWeights();
    const nw = sw.map((w, i) => tf.add(tf.mul(w, tau), tf.mul(tw[i], 1 - tau)));
    target.setWeights(nw);
    nw.forEach(w => w.dispose());
  }

  /** Select discrete action: actor + optional noise + argmax */
  async selectAction(state: tf.Tensor3D, noise = true): Promise<number> {
    return tf.tidy(() => {
      const sb = state.expandDims(0); // [1, rows, cols, channels]
      let act = this.actor.predict(sb) as tf.Tensor2D;
      let cont = act.squeeze() as tf.Tensor1D;
      if (noise) {
        const n = tf.randomNormal([ACTION_SIZE], 0, this.policyNoise);
        cont = tf.clipByValue(tf.add(cont, n), -1, 1) as tf.Tensor1D;
        n.dispose();
      }
      const vals = cont.arraySync() as number[];
      act.dispose(); sb.dispose(); cont.dispose();
      return vals.indexOf(Math.max(...vals));
    });
  }

  storeTransition(t: Transition) { this.replay.push(t); }

  /** Update step: twin critics + delayed actor */
  async update(batchSize = 64) {
    if (this.replay.size() < batchSize) return;
    this.totalIt++;
    const batch = this.replay.sample(batchSize);
    const states = tf.stack(batch.map(t => t.state)) as tf.Tensor4D;
    const nextStates = tf.stack(batch.map(t => t.nextState)) as tf.Tensor4D;
    const actions = tf.tensor2d(batch.map(t => {
      const arr = Array(ACTION_SIZE).fill(0);
      arr[t.action] = 1;
      return arr;
    })) as tf.Tensor2D;
    const rewards = tf.tensor1d(batch.map(t => t.reward)) as tf.Tensor1D;
    const dones = tf.tensor1d(batch.map(t => t.done ? 1 : 0)) as tf.Tensor1D;

    // Critic update
    await this.criticOpt.minimize(() => {
      const noise = tf.randomNormal([batchSize, ACTION_SIZE], 0, this.policyNoise);
      const na = this.actorTarget.predict(nextStates) as tf.Tensor2D;
      const naCl = tf.clipByValue(tf.add(na, noise), -1, 1) as tf.Tensor2D;
      noise.dispose(); na.dispose();
      const idx = tf.argMax(naCl, 1) as tf.Tensor1D;
      const naOne = tf.oneHot(idx, ACTION_SIZE) as tf.Tensor2D;
      naCl.dispose(); idx.dispose();

      const q1t = this.criticTarget1.predict([nextStates, naOne]) as tf.Tensor2D;
      const q2t = this.criticTarget2.predict([nextStates, naOne]) as tf.Tensor2D;
      const minQt = tf.minimum(q1t, q2t).squeeze() as tf.Tensor1D;
      q1t.dispose(); q2t.dispose(); naOne.dispose();

      const targetQ = tf.add(rewards, tf.mul(tf.sub(1, dones), tf.mul(minQt, this.gamma))) as tf.Tensor1D;
      minQt.dispose(); rewards.dispose(); dones.dispose();

      const q1 = this.critic1.predict([states, actions]) as tf.Tensor2D;
      const q2 = this.critic2.predict([states, actions]) as tf.Tensor2D;
      const l1 = tf.losses.meanSquaredError(targetQ, q1.squeeze());
      const l2 = tf.losses.meanSquaredError(targetQ, q2.squeeze());
      q1.dispose(); q2.dispose(); targetQ.dispose();

      const loss = tf.add(l1, l2) as tf.Scalar;
      console.log(`Critic loss: ${loss.dataSync()[0].toFixed(4)}`);
      return loss;
    });

    // Delayed actor/policy update
    if (this.totalIt % this.policyDelay === 0) {
      await this.actorOpt.minimize(() => {
        const ap = this.actor.predict(states) as tf.Tensor2D;
        const idxs = tf.argMax(ap, 1) as tf.Tensor1D;
        const oneHot = tf.oneHot(idxs, ACTION_SIZE) as tf.Tensor2D;
        idxs.dispose(); ap.dispose();
        const qv = this.critic1.predict([states, oneHot]) as tf.Tensor2D;
        oneHot.dispose();
        const aLoss = tf.neg(tf.mean(qv)) as tf.Scalar;
        qv.dispose(); console.log(`Actor loss: ${aLoss.dataSync()[0].toFixed(4)}`);
        return aLoss;
      });
      this.softUpdate(this.actorTarget, this.actor, this.tau);
      this.softUpdate(this.criticTarget1, this.critic1, this.tau);
      this.softUpdate(this.criticTarget2, this.critic2, this.tau);
    }

    states.dispose(); nextStates.dispose(); actions.dispose();
  }

  /** Save networks to filesystem */
  async save(dir: string) {
    await this.actor.save(`file://${dir}/actor`);
    await this.critic1.save(`file://${dir}/critic1`);
    await this.critic2.save(`file://${dir}/critic2`);
  }

  /** Load networks from filesystem */
  async load(dir: string) {
    this.actor = await tf.loadLayersModel(`file://${dir}/actor/model.json`);
    this.critic1 = await tf.loadLayersModel(`file://${dir}/critic1/model.json`);
    this.critic2 = await tf.loadLayersModel(`file://${dir}/critic2/model.json`);
    this.softUpdate(this.actorTarget, this.actor, 1);
    this.softUpdate(this.criticTarget1, this.critic1, 1);
    this.softUpdate(this.criticTarget2, this.critic2, 1);
  }

  dispose() {
    this.actor.dispose(); this.actorTarget.dispose();
    this.critic1.dispose(); this.critic2.dispose();
    this.criticTarget1.dispose(); this.criticTarget2.dispose();
  }
}
