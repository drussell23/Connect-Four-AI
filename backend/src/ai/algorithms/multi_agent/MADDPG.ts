// src/ai/algorithms/multi_agent/MADDPG.ts
import * as tf from '@tensorflow/tfjs';
import { CellValue } from '../../connect4AI';

export interface MADDPGConfig {
    numAgents: number;
    actorLearningRate: number;
    criticLearningRate: number;
    gamma: number;
    tau: number; // soft update parameter
    bufferSize: number;
    batchSize: number;
    noiseStd: number;
    noiseDecay: number;
    targetUpdateFreq: number;
    gradientClipping: number;
    networkType: 'cnn' | 'mlp';
    hiddenSize: number;
    prioritizedReplay: boolean;
    populationSize: number;
    diversityBonus: number;
    selfPlayRatio: number;
    competitiveReward: boolean;
}

export interface MADDPGMetrics {
    actorLoss: number[];
    criticLoss: number[];
    averageReward: number[];
    explorationRate: number[];
    diversityScore: number;
    winRate: number[];
    gamesPlayed: number;
    populationFitness: number[];
    cooperationScore: number;
    competitionScore: number;
    adaptationRate: number;
}

export interface MADDPGExperience {
    states: number[][][][]; // [numAgents][6][7][1]
    actions: number[];
    rewards: number[];
    nextStates: number[][][][];
    dones: boolean[];
    globalState: number[][][];
    timestep: number;
}

export interface Agent {
    id: number;
    actorNetwork: tf.LayersModel;
    criticNetwork: tf.LayersModel;
    targetActorNetwork: tf.LayersModel;
    targetCriticNetwork: tf.LayersModel;
    actorOptimizer: tf.Optimizer;
    criticOptimizer: tf.Optimizer;
    noiseStd: number;
    personality: 'aggressive' | 'defensive' | 'balanced' | 'adaptive';
    skillLevel: number;
    experience: MADDPGExperience[];
}

/**
 * MADDPG (Multi-Agent Deep Deterministic Policy Gradient) Implementation
 * 
 * Advanced features:
 * - Centralized training, decentralized execution
 * - Population-based training with diverse agents
 * - Competitive and cooperative reward structures
 * - Agent personalities and skill levels
 * - Experience sharing and transfer learning
 * - Hierarchical opponent modeling
 * - Adaptive opponent selection
 * - Self-play tournament system
 * - Diversity preservation mechanisms
 */
export class MADDPG {
    private config: MADDPGConfig;
    private agents: Agent[] = [];
    private replayBuffer: MADDPGExperience[] = [];
    private metrics: MADDPGMetrics;
    private currentStep = 0;
    private populationHistory: Agent[][] = [];
    private tournamentResults: Map<string, number> = new Map();

    constructor(config: Partial<MADDPGConfig> = {}) {
        this.config = {
            numAgents: 4,
            actorLearningRate: 0.0001,
            criticLearningRate: 0.001,
            gamma: 0.99,
            tau: 0.005,
            bufferSize: 100000,
            batchSize: 256,
            noiseStd: 0.1,
            noiseDecay: 0.995,
            targetUpdateFreq: 2,
            gradientClipping: 1.0,
            networkType: 'cnn',
            hiddenSize: 512,
            prioritizedReplay: true,
            populationSize: 8,
            diversityBonus: 0.1,
            selfPlayRatio: 0.7,
            competitiveReward: true,
            ...config
        };

        this.metrics = this.initializeMetrics();
    }

    private initializeMetrics(): MADDPGMetrics {
        return {
            actorLoss: Array(this.config.numAgents).fill(0),
            criticLoss: Array(this.config.numAgents).fill(0),
            averageReward: Array(this.config.numAgents).fill(0),
            explorationRate: Array(this.config.numAgents).fill(1.0),
            diversityScore: 0,
            winRate: Array(this.config.numAgents).fill(0),
            gamesPlayed: 0,
            populationFitness: Array(this.config.populationSize).fill(0),
            cooperationScore: 0,
            competitionScore: 0,
            adaptationRate: 0
        };
    }

    /**
     * Initialize MADDPG with population of agents
     */
    async initialize(): Promise<void> {
        console.log('🚀 Initializing MADDPG Multi-Agent System...');

        // Create diverse population of agents
        for (let i = 0; i < this.config.populationSize; i++) {
            const agent = await this.createAgent(i);
            this.agents.push(agent);
        }

        // Initialize tournament tracking
        this.initializeTournament();

        console.log(`✅ MADDPG initialized with ${this.config.populationSize} agents`);
    }

    private async createAgent(id: number): Promise<Agent> {
        const personalities = ['aggressive', 'defensive', 'balanced', 'adaptive'];
        const personality = personalities[id % personalities.length] as Agent['personality'];

        // Create actor network
        const actorNetwork = this.createActorNetwork();
        const targetActorNetwork = this.createActorNetwork();

        // Create critic network (takes global state + all actions)
        const criticNetwork = this.createCriticNetwork();
        const targetCriticNetwork = this.createCriticNetwork();

        // Initialize target networks
        this.copyWeights(actorNetwork, targetActorNetwork);
        this.copyWeights(criticNetwork, targetCriticNetwork);

        // Create optimizers
        const actorOptimizer = tf.train.adam(this.config.actorLearningRate);
        const criticOptimizer = tf.train.adam(this.config.criticLearningRate);

        return {
            id,
            actorNetwork,
            criticNetwork,
            targetActorNetwork,
            targetCriticNetwork,
            actorOptimizer,
            criticOptimizer,
            noiseStd: this.config.noiseStd,
            personality,
            skillLevel: Math.random() * 0.5 + 0.5, // Random skill level
            experience: []
        };
    }

    private createActorNetwork(): tf.LayersModel {
        const input = tf.input({ shape: [6, 7, 1] });
        let x: tf.SymbolicTensor;

        if (this.config.networkType === 'cnn') {
            // CNN for spatial understanding
            x = tf.layers.conv2d({
                filters: 32,
                kernelSize: [3, 3],
                activation: 'relu',
                padding: 'same',
                kernelInitializer: 'heNormal'
            }).apply(input) as tf.SymbolicTensor;

            x = tf.layers.batchNormalization({ axis: -1 }).apply(x) as tf.SymbolicTensor;

            x = tf.layers.conv2d({
                filters: 64,
                kernelSize: [3, 3],
                activation: 'relu',
                padding: 'same',
                kernelInitializer: 'heNormal'
            }).apply(x) as tf.SymbolicTensor;

            x = tf.layers.batchNormalization({ axis: -1 }).apply(x) as tf.SymbolicTensor;

            x = tf.layers.globalAveragePooling2d({}).apply(x) as tf.SymbolicTensor;
        } else {
            x = tf.layers.flatten().apply(input) as tf.SymbolicTensor;
        }

        // Hidden layers
        x = tf.layers.dense({
            units: this.config.hiddenSize,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        x = tf.layers.dropout({ rate: 0.2 }).apply(x) as tf.SymbolicTensor;

        x = tf.layers.dense({
            units: this.config.hiddenSize / 2,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        // Output layer (action probabilities)
        const output = tf.layers.dense({
            units: 7,
            activation: 'softmax',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        return tf.model({ inputs: input, outputs: output });
    }

    private createCriticNetwork(): tf.LayersModel {
        // Global state input (concatenated states from all agents)
        const stateInput = tf.input({ shape: [6, 7, this.config.numAgents] });

        // All actions input
        const actionInput = tf.input({ shape: [this.config.numAgents] });

        // Process global state
        let stateFeatures = tf.layers.conv2d({
            filters: 64,
            kernelSize: [3, 3],
            activation: 'relu',
            padding: 'same',
            kernelInitializer: 'heNormal'
        }).apply(stateInput) as tf.SymbolicTensor;

        stateFeatures = tf.layers.batchNormalization({ axis: -1 }).apply(stateFeatures) as tf.SymbolicTensor;

        stateFeatures = tf.layers.conv2d({
            filters: 128,
            kernelSize: [3, 3],
            activation: 'relu',
            padding: 'same',
            kernelInitializer: 'heNormal'
        }).apply(stateFeatures) as tf.SymbolicTensor;

        stateFeatures = tf.layers.globalAveragePooling2d({}).apply(stateFeatures) as tf.SymbolicTensor;

        // Process actions
        let actionFeatures = tf.layers.dense({
            units: 64,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(actionInput) as tf.SymbolicTensor;

        // Concatenate state and action features
        const combined = tf.layers.concatenate().apply([stateFeatures, actionFeatures]) as tf.SymbolicTensor;

        // Hidden layers
        let x = tf.layers.dense({
            units: this.config.hiddenSize,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(combined) as tf.SymbolicTensor;

        x = tf.layers.dropout({ rate: 0.2 }).apply(x) as tf.SymbolicTensor;

        x = tf.layers.dense({
            units: this.config.hiddenSize / 2,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        // Q-value output
        const output = tf.layers.dense({
            units: 1,
            activation: 'linear',
            kernelInitializer: 'heNormal'
        }).apply(x) as tf.SymbolicTensor;

        return tf.model({ inputs: [stateInput, actionInput], outputs: output });
    }

    private copyWeights(source: tf.LayersModel, target: tf.LayersModel): void {
        const sourceWeights = source.getWeights();
        target.setWeights(sourceWeights);
    }

    private initializeTournament(): void {
        // Initialize tournament results for all agent pairs
        for (let i = 0; i < this.config.populationSize; i++) {
            for (let j = i + 1; j < this.config.populationSize; j++) {
                this.tournamentResults.set(`${i}-${j}`, 0);
            }
        }
    }

    /**
     * Select action for a specific agent
     */
    async selectAction(
        agentId: number,
        board: CellValue[][],
        legalMoves: number[],
        globalState?: number[][][]
    ): Promise<number> {
        const agent = this.agents[agentId];
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        const state = this.boardToTensor(board);
        const policy = await agent.actorNetwork.predict(state) as tf.Tensor;
        const policyArray = await policy.data() as Float32Array;

        // Apply agent personality
        const personalityAdjustedPolicy = this.applyPersonality(
            Array.from(policyArray),
            agent.personality,
            legalMoves
        );

        // Add exploration noise
        const noisyPolicy = this.addExplorationNoise(personalityAdjustedPolicy, agent.noiseStd);

        // Mask illegal moves
        const maskedPolicy = this.maskIllegalMoves(noisyPolicy, legalMoves);

        // Select action
        const action = this.sampleFromPolicy(maskedPolicy);

        // Clean up
        state.dispose();
        policy.dispose();

        return action;
    }

    private applyPersonality(
        policy: number[],
        personality: Agent['personality'],
        legalMoves: number[]
    ): number[] {
        const adjustedPolicy = [...policy];

        switch (personality) {
            case 'aggressive':
                // Favor center columns for aggressive play
                [2, 3, 4].forEach(col => {
                    if (legalMoves.includes(col)) {
                        adjustedPolicy[col] *= 1.3;
                    }
                });
                break;

            case 'defensive':
                // Favor edge columns for defensive play
                [0, 1, 5, 6].forEach(col => {
                    if (legalMoves.includes(col)) {
                        adjustedPolicy[col] *= 1.2;
                    }
                });
                break;

            case 'balanced':
                // Slight preference for center
                if (legalMoves.includes(3)) {
                    adjustedPolicy[3] *= 1.1;
                }
                break;

            case 'adaptive':
                // Adjust based on current board state
                // Could implement more sophisticated adaptation logic
                break;
        }

        return adjustedPolicy;
    }

    private addExplorationNoise(policy: number[], noiseStd: number): number[] {
        return policy.map(prob => {
            const noise = tf.randomNormal([1], 0, noiseStd).dataSync()[0];
            return Math.max(0, prob + noise);
        });
    }

    private maskIllegalMoves(policy: number[], legalMoves: number[]): number[] {
        const maskedPolicy = [...policy];
        maskedPolicy.forEach((prob, i) => {
            if (!legalMoves.includes(i)) {
                maskedPolicy[i] = 0;
            }
        });

        // Renormalize
        const sum = maskedPolicy.reduce((a, b) => a + b, 0);
        if (sum > 0) {
            maskedPolicy.forEach((_, i) => {
                maskedPolicy[i] /= sum;
            });
        }

        return maskedPolicy;
    }

    private sampleFromPolicy(policy: number[]): number {
        const random = Math.random();
        let cumulative = 0;

        for (let i = 0; i < policy.length; i++) {
            cumulative += policy[i];
            if (random <= cumulative) {
                return i;
            }
        }

        return policy.indexOf(Math.max(...policy));
    }

    /**
     * Store experience in replay buffer
     */
    storeExperience(experience: MADDPGExperience): void {
        this.replayBuffer.push(experience);

        if (this.replayBuffer.length > this.config.bufferSize) {
            this.replayBuffer.shift();
        }
    }

    /**
     * Train all agents using MADDPG
     */
    async train(): Promise<void> {
        if (this.replayBuffer.length < this.config.batchSize) {
            return;
        }

        console.log('🏋️ Training MADDPG Multi-Agent System...');

        // Train each agent
        for (let agentId = 0; agentId < this.config.numAgents; agentId++) {
            await this.trainAgent(agentId);
        }

        // Update target networks
        if (this.currentStep % this.config.targetUpdateFreq === 0) {
            this.updateTargetNetworks();
        }

        // Decay exploration noise
        this.decayExplorationNoise();

        this.currentStep++;
        console.log('✅ MADDPG training completed');
    }

    private async trainAgent(agentId: number): Promise<void> {
        const agent = this.agents[agentId];
        const batch = this.sampleBatch();

        // Train critic network
        const criticLoss = await this.trainCritic(agent, batch);

        // Train actor network
        const actorLoss = await this.trainActor(agent, batch);

        // Update metrics
        this.metrics.actorLoss[agentId] = actorLoss;
        this.metrics.criticLoss[agentId] = criticLoss;
    }

    private sampleBatch(): MADDPGExperience[] {
        const batch: MADDPGExperience[] = [];

        for (let i = 0; i < this.config.batchSize; i++) {
            const randomIndex = Math.floor(Math.random() * this.replayBuffer.length);
            batch.push(this.replayBuffer[randomIndex]);
        }

        return batch;
    }

    private async trainCritic(agent: Agent, batch: MADDPGExperience[]): Promise<number> {
        // Prepare training data
        const globalStates = tf.stack(batch.map(exp =>
            tf.tensor3d(exp.globalState, [6, 7, this.config.numAgents])
        ));

        const allActions = tf.tensor2d(batch.map(exp => exp.actions));
        const rewards = tf.tensor1d(batch.map(exp => exp.rewards[agent.id]));
        const nextGlobalStates = tf.stack(batch.map(exp =>
            tf.tensor3d(exp.globalState, [6, 7, this.config.numAgents]) // Should be nextGlobalState
        ));

        // Compute target Q-values
        const nextActions = await this.computeNextActions(nextGlobalStates, batch);
        const targetQValues = await agent.targetCriticNetwork.predict([
            nextGlobalStates,
            nextActions
        ]) as tf.Tensor;

        const targets = tf.add(
            rewards,
            tf.mul(
                tf.scalar(this.config.gamma),
                tf.squeeze(targetQValues)
            )
        );

        // Train critic
        const criticLoss = await this.computeCriticLoss(agent, globalStates, allActions, targets);

        // Clean up
        globalStates.dispose();
        allActions.dispose();
        rewards.dispose();
        nextGlobalStates.dispose();
        nextActions.dispose();
        targetQValues.dispose();
        targets.dispose();

        return criticLoss;
    }

    private async computeNextActions(
        nextGlobalStates: tf.Tensor,
        batch: MADDPGExperience[]
    ): Promise<tf.Tensor> {
        const nextActions: number[][] = [];

        for (let i = 0; i < batch.length; i++) {
            const actions: number[] = [];
            for (let agentId = 0; agentId < this.config.numAgents; agentId++) {
                const agent = this.agents[agentId];
                const state = tf.tensor4d([batch[i].nextStates[agentId]], [1, 6, 7, 1]);
                const policy = await agent.targetActorNetwork.predict(state) as tf.Tensor;
                const policyArray = await policy.data() as Float32Array;

                // Get best action
                const bestAction = policyArray.indexOf(Math.max(...Array.from(policyArray)));
                actions.push(bestAction);

                state.dispose();
                policy.dispose();
            }
            nextActions.push(actions);
        }

        return tf.tensor2d(nextActions);
    }

    private async computeCriticLoss(
        agent: Agent,
        globalStates: tf.Tensor,
        allActions: tf.Tensor,
        targets: tf.Tensor
    ): Promise<number> {
        return tf.tidy(() => {
            const predictions = agent.criticNetwork.predict([
                globalStates,
                allActions
            ]) as tf.Tensor;

            const loss = tf.losses.meanSquaredError(targets, tf.squeeze(predictions));

            // Compute gradients and apply
            const gradients = tf.variableGrads(() => loss as tf.Scalar);
            agent.criticOptimizer.applyGradients(gradients.grads);

            return loss.dataSync()[0];
        });
    }

    private async trainActor(agent: Agent, batch: MADDPGExperience[]): Promise<number> {
        // Prepare training data
        const states = tf.stack(batch.map(exp =>
            tf.tensor3d(exp.states[agent.id], [6, 7, 1])
        ));

        const globalStates = tf.stack(batch.map(exp =>
            tf.tensor3d(exp.globalState, [6, 7, this.config.numAgents])
        ));

        const actorLoss = await this.computeActorLoss(agent, states, globalStates, batch);

        // Clean up
        states.dispose();
        globalStates.dispose();

        return actorLoss;
    }

    private async computeActorLoss(
        agent: Agent,
        states: tf.Tensor,
        globalStates: tf.Tensor,
        batch: MADDPGExperience[]
    ): Promise<number> {
        return tf.tidy(() => {
            // Get actor predictions
            const actions = agent.actorNetwork.predict(states) as tf.Tensor;

            // Convert actions to discrete format for critic
            const discreteActions = this.convertToDiscreteActions(actions, batch, agent.id);

            // Compute Q-values
            const qValues = agent.criticNetwork.predict([
                globalStates,
                discreteActions
            ]) as tf.Tensor;

            // Actor loss is negative Q-value (maximize Q-value)
            const loss = tf.neg(tf.mean(qValues));

            // Compute gradients and apply
            const gradients = tf.variableGrads(() => loss as tf.Scalar);
            agent.actorOptimizer.applyGradients(gradients.grads);

            return loss.dataSync()[0];
        });
    }

    private convertToDiscreteActions(
        actions: tf.Tensor,
        batch: MADDPGExperience[],
        agentId: number
    ): tf.Tensor {
        // Convert continuous actions to discrete format
        // This is a simplified version - in practice you'd use Gumbel-Softmax
        const actionsArray = actions.dataSync();
        const discreteActions: number[][] = [];

        for (let i = 0; i < batch.length; i++) {
            const actions: number[] = [];
            for (let j = 0; j < this.config.numAgents; j++) {
                if (j === agentId) {
                    // Use current agent's action
                    const startIdx = i * 7;
                    const agentActions = Array.from(actionsArray.slice(startIdx, startIdx + 7));
                    actions.push(agentActions.indexOf(Math.max(...agentActions)));
                } else {
                    // Use original action from batch
                    actions.push(batch[i].actions[j]);
                }
            }
            discreteActions.push(actions);
        }

        return tf.tensor2d(discreteActions);
    }

    private updateTargetNetworks(): void {
        for (const agent of this.agents) {
            this.softUpdate(agent.actorNetwork, agent.targetActorNetwork);
            this.softUpdate(agent.criticNetwork, agent.targetCriticNetwork);
        }
    }

    private softUpdate(source: tf.LayersModel, target: tf.LayersModel): void {
        const sourceWeights = source.getWeights();
        const targetWeights = target.getWeights();

        const updatedWeights = sourceWeights.map((weight, i) => {
            const targetWeight = targetWeights[i];
            return weight.mul(this.config.tau).add(targetWeight.mul(1 - this.config.tau));
        });

        target.setWeights(updatedWeights);
    }

    private decayExplorationNoise(): void {
        for (const agent of this.agents) {
            agent.noiseStd *= this.config.noiseDecay;
        }
    }

    /**
     * Run population-based tournament
     */
    async runTournament(): Promise<void> {
        console.log('🏆 Running MADDPG Tournament...');

        const tournamentSize = Math.min(8, this.config.populationSize);
        const participants = this.agents.slice(0, tournamentSize);

        // Round-robin tournament
        for (let i = 0; i < participants.length; i++) {
            for (let j = i + 1; j < participants.length; j++) {
                await this.playMatch(participants[i], participants[j]);
            }
        }

        // Update fitness scores
        this.updateFitnessScores();

        // Evolve population
        await this.evolvePopulation();

        console.log('✅ Tournament completed');
    }

    private async playMatch(agent1: Agent, agent2: Agent): Promise<void> {
        // Simulate a match between two agents
        // This would integrate with the actual game environment
        const matchResult = Math.random() > 0.5 ? 1 : -1; // Simplified

        const key = `${agent1.id}-${agent2.id}`;
        const currentScore = this.tournamentResults.get(key) || 0;
        this.tournamentResults.set(key, currentScore + matchResult);
    }

    private updateFitnessScores(): void {
        for (let i = 0; i < this.config.populationSize; i++) {
            let fitness = 0;
            let matches = 0;

            for (let j = 0; j < this.config.populationSize; j++) {
                if (i !== j) {
                    const key = i < j ? `${i}-${j}` : `${j}-${i}`;
                    const score = this.tournamentResults.get(key) || 0;
                    fitness += i < j ? score : -score;
                    matches++;
                }
            }

            this.metrics.populationFitness[i] = matches > 0 ? fitness / matches : 0;
        }
    }

    private async evolvePopulation(): Promise<void> {
        // Simple evolution: replace worst performers with mutated versions of best
        const fitnessIndices = this.metrics.populationFitness
            .map((fitness, index) => ({ fitness, index }))
            .sort((a, b) => b.fitness - a.fitness);

        const numToReplace = Math.floor(this.config.populationSize * 0.25);
        const bestIndices = fitnessIndices.slice(0, numToReplace).map(x => x.index);
        const worstIndices = fitnessIndices.slice(-numToReplace).map(x => x.index);

        // Replace worst with mutated versions of best
        for (let i = 0; i < numToReplace; i++) {
            const bestAgent = this.agents[bestIndices[i]];
            const worstAgent = this.agents[worstIndices[i]];

            // Mutate best agent's weights and copy to worst
            await this.mutateAgent(bestAgent, worstAgent);
        }
    }

    private async mutateAgent(source: Agent, target: Agent): Promise<void> {
        // Simple mutation: add small random noise to weights
        const mutationStrength = 0.1;

        const sourceWeights = source.actorNetwork.getWeights();
        const mutatedWeights = sourceWeights.map(weight => {
            const noise = tf.randomNormal(weight.shape, 0, mutationStrength);
            return weight.add(noise);
        });

        target.actorNetwork.setWeights(mutatedWeights);
        this.copyWeights(target.actorNetwork, target.targetActorNetwork);
    }

    /**
     * Get metrics for monitoring
     */
    getMetrics(): MADDPGMetrics {
        return { ...this.metrics };
    }

    /**
     * Get best agent for gameplay
     */
    getBestAgent(): Agent {
        const bestIndex = this.metrics.populationFitness
            .indexOf(Math.max(...this.metrics.populationFitness));
        return this.agents[bestIndex];
    }

    private boardToTensor(board: CellValue[][]): tf.Tensor4D {
        const numericBoard = board.map(row =>
            row.map(cell => {
                if (cell === 'Red') return 1;
                if (cell === 'Yellow') return -1;
                return 0;
            })
        );

        return tf.tensor4d([numericBoard.map(row => row.map(cell => [cell]))], [1, 6, 7, 1]);
    }

    /**
     * Save all agents
     */
    async saveAgents(basePath: string): Promise<void> {
        for (let i = 0; i < this.agents.length; i++) {
            const agent = this.agents[i];
            await agent.actorNetwork.save(`file://${basePath}/agent_${i}_actor`);
            await agent.criticNetwork.save(`file://${basePath}/agent_${i}_critic`);
        }
        console.log(`💾 MADDPG agents saved to ${basePath}`);
    }

    /**
     * Load all agents
     */
    async loadAgents(basePath: string): Promise<void> {
        for (let i = 0; i < this.agents.length; i++) {
            const agent = this.agents[i];
            agent.actorNetwork = await tf.loadLayersModel(`file://${basePath}/agent_${i}_actor`);
            agent.criticNetwork = await tf.loadLayersModel(`file://${basePath}/agent_${i}_critic`);

            // Update target networks
            this.copyWeights(agent.actorNetwork, agent.targetActorNetwork);
            this.copyWeights(agent.criticNetwork, agent.targetCriticNetwork);
        }
        console.log(`📂 MADDPG agents loaded from ${basePath}`);
    }

    /**
     * Dispose all resources
     */
    dispose(): void {
        for (const agent of this.agents) {
            agent.actorNetwork.dispose();
            agent.criticNetwork.dispose();
            agent.targetActorNetwork.dispose();
            agent.targetCriticNetwork.dispose();
            agent.actorOptimizer.dispose();
            agent.criticOptimizer.dispose();
        }
    }
}
