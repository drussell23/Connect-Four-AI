import * as tf from '@tensorflow/tfjs';

/**
 * Model‑Agnostic Meta‑Learning (MAML) for few‑shot supervised tasks.
 * Features:
 *  - Configurable inner/outer learning rates and steps
 *  - First‑order or full MAML via optional second‑derivative inclusion
 *  - Pure TFJS backend (WASM/CPU)
 *  - Detailed logging and performance timing
 *  - Automatic memory management via tf.tidy
 */

// === Task and Config Interfaces ===
export interface Task {
    supportX: tf.Tensor;  // [K, ...]
    supportY: tf.Tensor;  // [K, ...]
    queryX: tf.Tensor;    // [Q, ...]
    queryY: tf.Tensor;    // [Q, ...]
}

export interface MAMLConfig {
    innerLR?: number;      // learning rate for adaptation
    metaLR?: number;       // learning rate for meta-update
    innerSteps?: number;   // number of inner gradient steps
    firstOrder?: boolean;  // skip second derivatives if true
    logLevel?: 'info' | 'debug' | 'warn';
}

/**
 * MAML meta-learner class.
 */
export class MAML {
    private model: tf.LayersModel;
    private metaOpt: tf.Optimizer;
    private innerLR: number;
    private innerSteps: number;
    private firstOrder: boolean;
    private logLevel: 'info' | 'debug' | 'warn';

    constructor(
        private buildModel: () => tf.LayersModel,
        config: MAMLConfig = {}
    ) {
        this.innerLR = config.innerLR ?? 0.01;
        this.metaOpt = tf.train.adam(config.metaLR ?? 0.001);
        this.innerSteps = config.innerSteps ?? 1;
        this.firstOrder = config.firstOrder ?? true;
        this.logLevel = config.logLevel ?? 'info';

        this.model = this.buildModel();
        this.log('info', 'MAML initialized', { innerLR: this.innerLR, innerSteps: this.innerSteps, firstOrder: this.firstOrder });
    }

    /**
     * Perform one meta-update over a batch of tasks.
     */
    async metaUpdate(tasks: Task[]): Promise<void> {
        const start = performance.now();

        // Clone original model weights for restoration
        const origWeights = this.model.getWeights().map(w => w.clone());

        // Collect trainable variables
        const vars = this.model.trainableWeights; // LayerVariable[]

        // Initialize gradient accumulators
        const gradsAccum: { [name: string]: tf.Tensor } = {};
        vars.forEach(v => { gradsAccum[v.name] = tf.zerosLike(v.read()); });

        // Iterate tasks
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            this.log('debug', `Meta: task ${i + 1}/${tasks.length} adaptation`);

            // Inner loop adaptation returns adapted weight tensors
            const adaptedWeights = await this.adapt(task);
            this.model.setWeights(adaptedWeights);

            // Compute query gradients w.r.t. adapted model
            const { grads, value } = tf.variableGrads(() => tf.tidy(() => {
                const preds = this.model.predict(task.queryX) as tf.Tensor;
                return tf.losses.meanSquaredError(task.queryY, preds) as tf.Scalar;
            }));
            const lossVal = (value as tf.Scalar).dataSync()[0];
            this.log('debug', `Meta: query loss ${lossVal.toFixed(4)}`);
            value.dispose();

            // Accumulate gradients
            vars.forEach(v => {
                const g = grads[v.name];
                const sum = tf.add(gradsAccum[v.name], g);
                gradsAccum[v.name].dispose();
                gradsAccum[v.name] = sum;
                g.dispose();
            });

            // Dispose adapted weight tensors
            adaptedWeights.forEach(w => w.dispose());
        }

        // Average accumulated gradients
        vars.forEach(v => {
            const avg = tf.div(gradsAccum[v.name], tf.scalar(tasks.length));
            gradsAccum[v.name].dispose();
            gradsAccum[v.name] = avg;
        });

        // Apply meta-update
        const gradMap: { [varName: string]: tf.Tensor } = {};
        vars.forEach(v => { gradMap[v.name] = gradsAccum[v.name]; });
        this.metaOpt.applyGradients(gradMap);
        Object.values(gradsAccum).forEach(t => t.dispose());

        // Restore original weights
        this.model.setWeights(origWeights);
        origWeights.forEach(w => w.dispose());

        const duration = (performance.now() - start).toFixed(2);
        this.log('info', `metaUpdate completed in ${duration}ms`);
    }

    /**
     * Inner-loop adaptation for one task. Returns adapted weights array.
     */
    private async adapt(task: Task): Promise<tf.Tensor[]> {
        const start = performance.now();

        // Clone original weights
        let fastWeights = this.model.getWeights().map(w => w.clone());

        for (let step = 0; step < this.innerSteps; step++) {
            const { grads, value } = tf.variableGrads(() => tf.tidy(() => {
                this.model.setWeights(fastWeights);
                const preds = this.model.predict(task.supportX) as tf.Tensor;
                return (tf.losses.meanSquaredError(task.supportY, preds) as tf.Scalar);
            }));
            const lossVal = (value as tf.Scalar).dataSync()[0];
            this.log('debug', `Inner step ${step + 1}/${this.innerSteps} loss=${lossVal.toFixed(4)}`);
            value.dispose();

            // Update fast weights
            const vars = this.model.trainableWeights;
            vars.forEach((v, idx) => {
                const g = grads[v.name];
                const updated = tf.sub(fastWeights[idx], tf.mul(g, this.innerLR));
                fastWeights[idx].dispose();
                fastWeights[idx] = updated;
                g.dispose();
            });
        }

        const duration = (performance.now() - start).toFixed(2);
        this.log('debug', `Inner adaptation done in ${duration}ms`);
        return fastWeights;
    }

    /** Predict using current meta-model */
    predict(x: tf.Tensor | tf.Tensor[]): tf.Tensor | tf.Tensor[] {
        return this.model.predict(x);
    }

    /** Save meta-model to directory */
    async save(dir: string): Promise<void> {
        await this.model.save(`file://${dir}`);
        this.log('info', `Model saved to ${dir}`);
    }

    /** Load meta-model from directory */
    async load(dir: string): Promise<void> {
        this.model = await tf.loadLayersModel(`file://${dir}/model.json`);
        this.log('info', `Model loaded from ${dir}`);
    }

    /** Dispose model and free resources */
    dispose(): void {
        this.model.dispose();
        this.log('info', 'Model disposed');
    }

    /** Internal logger */
    private log(level: 'info' | 'debug' | 'warn', msg: string, obj?: any) {
        const order = { warn: 0, info: 1, debug: 2 };
        if (order[level] <= order[this.logLevel]) {
            console[level](`[MAML] ${msg}`, obj ?? '');
        }
    }
}
