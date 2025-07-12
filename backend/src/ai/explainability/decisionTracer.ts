// src/ai/explainability/decisionTracer.ts
import { CellValue } from '../connect4AI';
import { AIDecision } from '../connect4AI';

export interface DecisionTrace {
    algorithm: string;
    depth: number;
    timestamp: number;
    boardState: CellValue[][];
    legalMoves: number[];
    selectedMove: number;
    confidence: number;
    reasoning: string;
    alternativeAnalysis: AlternativeAnalysis[];
    computationTime: number;
    nodesExplored: number;

    // Algorithm-specific data
    minimaxTrace?: MinimaxTrace;
    mctsTrace?: MCTSTrace;
    neuralNetworkTrace?: NeuralNetworkTrace;
    reinforcementLearningTrace?: RLTrace;
    multiAgentTrace?: MultiAgentTrace;

    // Strategic analysis
    threatAnalysis: ThreatAnalysis;
    opportunityAnalysis: OpportunityAnalysis;
    positionalAnalysis: PositionalAnalysis;

    // Human-interpretable explanation
    humanExplanation: HumanExplanation;
}

export interface AlternativeAnalysis {
    move: number;
    score: number;
    reasoning: string;
    confidence: number;
    threatLevel: number;
    opportunity: number;
    strategicValue: number;
    whyNotSelected: string;
}

export interface MinimaxTrace {
    maxDepth: number;
    actualDepth: number;
    principalVariation: number[];
    evaluationScores: { [move: number]: number };
    pruningStats: {
        alphaCutoffs: number;
        betaCutoffs: number;
        nodesEvaluated: number;
        nodesPruned: number;
    };
    timeManagement: {
        iterativeDepths: number[];
        timePerDepth: number[];
    };
}

export interface MCTSTrace {
    simulations: number;
    explorationConstant: number;
    treeStructure: MCTSNode[];
    bestPath: number[];
    valueEstimates: { [move: number]: number };
    visitCounts: { [move: number]: number };
    explorationBonus: { [move: number]: number };
    convergenceRate: number;
}

export interface MCTSNode {
    move: number;
    visits: number;
    value: number;
    children: MCTSNode[];
    isExpanded: boolean;
    ucbValue: number;
}

export interface NeuralNetworkTrace {
    networkType: string;
    inputTensor: number[][][];
    layerActivations: { [layer: string]: number[] };
    attentionWeights?: number[][];
    policyOutput: number[];
    valueOutput: number;
    confidence: number;
    featureImportance: { [feature: string]: number };
    gradients?: { [layer: string]: number[] };
    saliencyMap?: number[][];
}

export interface RLTrace {
    algorithm: string;
    qValues: number[];
    explorationRate: number;
    experienceReplay: boolean;
    targetNetwork: boolean;
    learningRate: number;
    lossValue: number;
    gradientNorm: number;
    memorySize: number;
    epsilonDecay: number;
}

export interface MultiAgentTrace {
    agentCount: number;
    coordination: number;
    competition: number;
    emergentBehavior: string[];
    roleDistribution: { [role: string]: number };
    communicationLevel: number;
    consensusReached: boolean;
    diversityScore: number;
}

export interface ThreatAnalysis {
    immediateThreat: boolean;
    threatLevel: number;
    threateningPositions: Array<{
        position: [number, number];
        threatType: 'horizontal' | 'vertical' | 'diagonal';
        severity: number;
        countermeasures: string[];
    }>;
    defensiveOptions: Array<{
        move: number;
        effectiveness: number;
        reasoning: string;
    }>;
}

export interface OpportunityAnalysis {
    winningMove: boolean;
    winningPositions: Array<{
        position: [number, number];
        winType: 'horizontal' | 'vertical' | 'diagonal';
        movesToWin: number;
        probability: number;
    }>;
    setups: Array<{
        move: number;
        type: 'fork' | 'trap' | 'buildup';
        effectiveness: number;
        reasoning: string;
    }>;
}

export interface PositionalAnalysis {
    centerControl: number;
    connectionStrength: number;
    flexibility: number;
    territorialAdvantage: number;
    pieceDistribution: { [column: number]: number };
    strategicPatterns: Array<{
        pattern: string;
        strength: number;
        location: [number, number];
    }>;
}

export interface HumanExplanation {
    primaryReason: string;
    secondaryReasons: string[];
    strategicGoal: string;
    tacticalConsiderations: string[];
    riskAssessment: string;
    alternativeOptions: string[];
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    confidence: 'low' | 'medium' | 'high' | 'very_high';
    complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
}

/**
 * Comprehensive Decision Tracing System
 * 
 * Features:
 * - Multi-algorithm tracing and analysis
 * - Strategic reasoning extraction
 * - Human-interpretable explanations
 * - Real-time decision visualization
 * - Comparative analysis across algorithms
 * - Educational explanations for different skill levels
 * - Threat and opportunity detection
 * - Performance and efficiency metrics
 */
export class DecisionTracer {
    private traces: DecisionTrace[] = [];
    private maxTraceHistory = 1000;
    private analysisDepth = 'detailed';
    private explanationLevel = 'expert';

    constructor(
        maxHistory = 1000,
        analysisDepth: 'basic' | 'detailed' | 'comprehensive' = 'detailed',
        explanationLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' = 'expert'
    ) {
        this.maxTraceHistory = maxHistory;
        this.analysisDepth = analysisDepth;
        this.explanationLevel = explanationLevel;
    }

    /**
     * Trace and analyze an AI decision
     */
    async traceDecision(
        algorithm: string,
        boardState: CellValue[][],
        decision: AIDecision,
        additionalData?: any
    ): Promise<DecisionTrace> {
        const startTime = Date.now();

        // Create base trace
        const trace: DecisionTrace = {
            algorithm,
            depth: decision.nodesExplored,
            timestamp: startTime,
            boardState: boardState.map(row => [...row]),
            legalMoves: this.getLegalMoves(boardState),
            selectedMove: decision.move,
            confidence: decision.confidence,
            reasoning: decision.reasoning,
            alternativeAnalysis: [],
            computationTime: decision.thinkingTime,
            nodesExplored: decision.nodesExplored,

            // Initialize analysis structures
            threatAnalysis: {} as ThreatAnalysis,
            opportunityAnalysis: {} as OpportunityAnalysis,
            positionalAnalysis: {} as PositionalAnalysis,
            humanExplanation: {} as HumanExplanation
        };

        // Add alternative analysis
        trace.alternativeAnalysis = await this.analyzeAlternatives(
            boardState,
            decision.alternativeMoves,
            decision.move
        );

        // Add algorithm-specific traces
        await this.addAlgorithmSpecificTrace(trace, algorithm, decision, additionalData);

        // Perform strategic analysis
        await this.performStrategicAnalysis(trace);

        // Generate human explanation
        await this.generateHumanExplanation(trace);

        // Store trace
        this.traces.push(trace);
        if (this.traces.length > this.maxTraceHistory) {
            this.traces.shift();
        }

        return trace;
    }

    private getLegalMoves(board: CellValue[][]): number[] {
        const legalMoves: number[] = [];
        for (let col = 0; col < 7; col++) {
            if (board[0][col] === 'Empty') {
                legalMoves.push(col);
            }
        }
        return legalMoves;
    }

    private async analyzeAlternatives(
        boardState: CellValue[][],
        alternativeMoves: AIDecision['alternativeMoves'],
        selectedMove: number
    ): Promise<AlternativeAnalysis[]> {
        const analyses: AlternativeAnalysis[] = [];

        for (const alt of alternativeMoves) {
            const analysis: AlternativeAnalysis = {
                move: alt.move,
                score: alt.score,
                reasoning: alt.reasoning,
                confidence: Math.min(1, alt.score / 1000), // Normalize score to confidence
                threatLevel: await this.calculateThreatLevel(boardState, alt.move),
                opportunity: await this.calculateOpportunity(boardState, alt.move),
                strategicValue: await this.calculateStrategicValue(boardState, alt.move),
                whyNotSelected: await this.explainWhyNotSelected(boardState, alt.move, selectedMove)
            };

            analyses.push(analysis);
        }

        return analyses.sort((a, b) => b.score - a.score);
    }

    private async addAlgorithmSpecificTrace(
        trace: DecisionTrace,
        algorithm: string,
        decision: AIDecision,
        additionalData?: any
    ): Promise<void> {
        switch (algorithm.toLowerCase()) {
            case 'minimax':
                trace.minimaxTrace = await this.extractMinimaxTrace(decision, additionalData);
                break;
            case 'mcts':
                trace.mctsTrace = await this.extractMCTSTrace(decision, additionalData);
                break;
            case 'alphazero':
                trace.neuralNetworkTrace = await this.extractNeuralNetworkTrace(decision, additionalData);
                trace.mctsTrace = await this.extractMCTSTrace(decision, additionalData);
                break;
            case 'dqn':
            case 'ppo':
            case 'a3c':
                trace.reinforcementLearningTrace = await this.extractRLTrace(decision, additionalData);
                trace.neuralNetworkTrace = await this.extractNeuralNetworkTrace(decision, additionalData);
                break;
            case 'maddpg':
            case 'qmix':
                trace.multiAgentTrace = await this.extractMultiAgentTrace(decision, additionalData);
                trace.reinforcementLearningTrace = await this.extractRLTrace(decision, additionalData);
                break;
        }
    }

    private async extractMinimaxTrace(decision: AIDecision, additionalData?: any): Promise<MinimaxTrace> {
        return {
            maxDepth: additionalData?.maxDepth || 10,
            actualDepth: additionalData?.actualDepth || decision.nodesExplored / 1000,
            principalVariation: additionalData?.principalVariation || [decision.move],
            evaluationScores: this.extractEvaluationScores(decision),
            pruningStats: {
                alphaCutoffs: additionalData?.alphaCutoffs || 0,
                betaCutoffs: additionalData?.betaCutoffs || 0,
                nodesEvaluated: decision.nodesExplored,
                nodesPruned: additionalData?.nodesPruned || 0
            },
            timeManagement: {
                iterativeDepths: additionalData?.iterativeDepths || [1, 2, 3, 4, 5],
                timePerDepth: additionalData?.timePerDepth || [10, 20, 50, 100, 200]
            }
        };
    }

    private async extractMCTSTrace(decision: AIDecision, additionalData?: any): Promise<MCTSTrace> {
        return {
            simulations: additionalData?.simulations || decision.nodesExplored,
            explorationConstant: additionalData?.explorationConstant || 1.414,
            treeStructure: additionalData?.treeStructure || [],
            bestPath: additionalData?.bestPath || [decision.move],
            valueEstimates: this.extractValueEstimates(decision),
            visitCounts: additionalData?.visitCounts || {},
            explorationBonus: additionalData?.explorationBonus || {},
            convergenceRate: additionalData?.convergenceRate || 0.95
        };
    }

    private async extractNeuralNetworkTrace(decision: AIDecision, additionalData?: any): Promise<NeuralNetworkTrace> {
        return {
            networkType: additionalData?.networkType || 'CNN',
            inputTensor: additionalData?.inputTensor || [],
            layerActivations: additionalData?.layerActivations || {},
            attentionWeights: additionalData?.attentionWeights,
            policyOutput: decision.metadata.neuralNetworkEvaluation?.policy || [],
            valueOutput: decision.metadata.neuralNetworkEvaluation?.value || 0,
            confidence: decision.metadata.neuralNetworkEvaluation?.confidence || decision.confidence,
            featureImportance: additionalData?.featureImportance || {},
            gradients: additionalData?.gradients,
            saliencyMap: additionalData?.saliencyMap
        };
    }

    private async extractRLTrace(decision: AIDecision, additionalData?: any): Promise<RLTrace> {
        return {
            algorithm: additionalData?.algorithm || 'DQN',
            qValues: decision.metadata.reinforcementLearning?.qValues || [],
            explorationRate: decision.metadata.reinforcementLearning?.epsilonValue || 0.1,
            experienceReplay: additionalData?.experienceReplay || true,
            targetNetwork: additionalData?.targetNetwork || true,
            learningRate: additionalData?.learningRate || 0.001,
            lossValue: additionalData?.lossValue || 0,
            gradientNorm: additionalData?.gradientNorm || 0,
            memorySize: additionalData?.memorySize || 10000,
            epsilonDecay: additionalData?.epsilonDecay || 0.995
        };
    }

    private async extractMultiAgentTrace(decision: AIDecision, additionalData?: any): Promise<MultiAgentTrace> {
        return {
            agentCount: additionalData?.agentCount || 2,
            coordination: additionalData?.coordination || 0.5,
            competition: additionalData?.competition || 0.8,
            emergentBehavior: additionalData?.emergentBehavior || [],
            roleDistribution: additionalData?.roleDistribution || {},
            communicationLevel: additionalData?.communicationLevel || 0.3,
            consensusReached: additionalData?.consensusReached || true,
            diversityScore: additionalData?.diversityScore || 0.6
        };
    }

    private extractEvaluationScores(decision: AIDecision): { [move: number]: number } {
        const scores: { [move: number]: number } = {};

        // Add selected move score
        scores[decision.move] = 1000;

        // Add alternative move scores
        decision.alternativeMoves.forEach(alt => {
            scores[alt.move] = alt.score;
        });

        return scores;
    }

    private extractValueEstimates(decision: AIDecision): { [move: number]: number } {
        const values: { [move: number]: number } = {};

        // Convert scores to value estimates
        decision.alternativeMoves.forEach(alt => {
            values[alt.move] = alt.score / 1000; // Normalize to [-1, 1]
        });

        values[decision.move] = 1.0; // Best move gets highest value

        return values;
    }

    private async performStrategicAnalysis(trace: DecisionTrace): Promise<void> {
        // Threat analysis
        trace.threatAnalysis = await this.analyzeThreat(trace.boardState, trace.selectedMove);

        // Opportunity analysis
        trace.opportunityAnalysis = await this.analyzeOpportunity(trace.boardState, trace.selectedMove);

        // Positional analysis
        trace.positionalAnalysis = await this.analyzePosition(trace.boardState, trace.selectedMove);
    }

    private async analyzeThreat(boardState: CellValue[][], selectedMove: number): Promise<ThreatAnalysis> {
        const threats = this.detectThreats(boardState);
        const defensiveOptions = this.findDefensiveOptions(boardState, threats);

        return {
            immediateThreat: threats.length > 0,
            threatLevel: threats.reduce((max, t) => Math.max(max, t.severity), 0),
            threateningPositions: threats,
            defensiveOptions
        };
    }

    private async analyzeOpportunity(boardState: CellValue[][], selectedMove: number): Promise<OpportunityAnalysis> {
        const winningPositions = this.detectWinningPositions(boardState);
        const setups = this.findSetupMoves(boardState);

        return {
            winningMove: winningPositions.length > 0,
            winningPositions,
            setups
        };
    }

    private async analyzePosition(boardState: CellValue[][], selectedMove: number): Promise<PositionalAnalysis> {
        return {
            centerControl: this.calculateCenterControl(boardState),
            connectionStrength: this.calculateConnectionStrength(boardState),
            flexibility: this.calculateFlexibility(boardState),
            territorialAdvantage: this.calculateTerritorialAdvantage(boardState),
            pieceDistribution: this.calculatePieceDistribution(boardState),
            strategicPatterns: this.detectStrategicPatterns(boardState)
        };
    }

    private detectThreats(boardState: CellValue[][]): ThreatAnalysis['threateningPositions'] {
        const threats: ThreatAnalysis['threateningPositions'] = [];

        // Check for immediate winning threats
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                if (boardState[row][col] !== 'Empty') {
                    const player = boardState[row][col];

                    // Check horizontal threats
                    if (this.checkDirection(boardState, row, col, 0, 1, player, 3)) {
                        threats.push({
                            position: [row, col],
                            threatType: 'horizontal',
                            severity: 0.9,
                            countermeasures: this.findCountermeasures(boardState, row, col, 0, 1)
                        });
                    }

                    // Check vertical threats
                    if (this.checkDirection(boardState, row, col, 1, 0, player, 3)) {
                        threats.push({
                            position: [row, col],
                            threatType: 'vertical',
                            severity: 0.9,
                            countermeasures: this.findCountermeasures(boardState, row, col, 1, 0)
                        });
                    }

                    // Check diagonal threats
                    if (this.checkDirection(boardState, row, col, 1, 1, player, 3)) {
                        threats.push({
                            position: [row, col],
                            threatType: 'diagonal',
                            severity: 0.9,
                            countermeasures: this.findCountermeasures(boardState, row, col, 1, 1)
                        });
                    }
                }
            }
        }

        return threats;
    }

    private detectWinningPositions(boardState: CellValue[][]): OpportunityAnalysis['winningPositions'] {
        const winningPositions: OpportunityAnalysis['winningPositions'] = [];

        // Check for immediate winning moves
        for (let col = 0; col < 7; col++) {
            if (boardState[0][col] === 'Empty') {
                // Find the row where the piece would land
                let row = 5;
                while (row >= 0 && boardState[row][col] !== 'Empty') {
                    row--;
                }

                if (row >= 0) {
                    // Temporarily place the piece and check for wins
                    boardState[row][col] = 'Red'; // Assume checking for Red

                    if (this.checkWin(boardState, row, col, 'Red')) {
                        winningPositions.push({
                            position: [row, col],
                            winType: 'horizontal', // Simplified
                            movesToWin: 1,
                            probability: 1.0
                        });
                    }

                    boardState[row][col] = 'Empty'; // Restore
                }
            }
        }

        return winningPositions;
    }

    private findSetupMoves(boardState: CellValue[][]): OpportunityAnalysis['setups'] {
        const setups: OpportunityAnalysis['setups'] = [];

        // Look for fork opportunities
        for (let col = 0; col < 7; col++) {
            if (boardState[0][col] === 'Empty') {
                const effectiveness = this.calculateSetupEffectiveness(boardState, col);
                if (effectiveness > 0.5) {
                    setups.push({
                        move: col,
                        type: 'fork',
                        effectiveness,
                        reasoning: `Move creates multiple winning threats`
                    });
                }
            }
        }

        return setups;
    }

    private findDefensiveOptions(boardState: CellValue[][], threats: any[]): ThreatAnalysis['defensiveOptions'] {
        const defensiveOptions: ThreatAnalysis['defensiveOptions'] = [];

        for (const threat of threats) {
            for (let col = 0; col < 7; col++) {
                if (boardState[0][col] === 'Empty') {
                    const effectiveness = this.calculateDefenseEffectiveness(boardState, col, threat);
                    if (effectiveness > 0.3) {
                        defensiveOptions.push({
                            move: col,
                            effectiveness,
                            reasoning: `Blocks ${threat.threatType} threat`
                        });
                    }
                }
            }
        }

        return defensiveOptions.sort((a, b) => b.effectiveness - a.effectiveness);
    }

    private async generateHumanExplanation(trace: DecisionTrace): Promise<void> {
        const boardState = trace.boardState;
        const selectedMove = trace.selectedMove;
        const confidence = trace.confidence;

        // Primary reason
        let primaryReason = '';
        if (trace.opportunityAnalysis.winningMove) {
            primaryReason = `This move wins the game immediately`;
        } else if (trace.threatAnalysis.immediateThreat) {
            primaryReason = `This move defends against an immediate threat`;
        } else {
            primaryReason = `This move improves the position strategically`;
        }

        // Secondary reasons
        const secondaryReasons: string[] = [];
        if (trace.positionalAnalysis.centerControl > 0.6) {
            secondaryReasons.push('Controls the center of the board');
        }
        if (trace.positionalAnalysis.connectionStrength > 0.7) {
            secondaryReasons.push('Strengthens piece connections');
        }
        if (trace.positionalAnalysis.flexibility > 0.6) {
            secondaryReasons.push('Maintains future options');
        }

        // Strategic goal
        let strategicGoal = '';
        if (trace.opportunityAnalysis.setups.length > 0) {
            strategicGoal = 'Setting up multiple threats';
        } else if (trace.threatAnalysis.defensiveOptions.length > 0) {
            strategicGoal = 'Defensive positioning';
        } else {
            strategicGoal = 'Building winning position';
        }

        // Risk assessment
        let riskAssessment = '';
        if (trace.threatAnalysis.threatLevel > 0.8) {
            riskAssessment = 'High risk - immediate threats exist';
        } else if (trace.threatAnalysis.threatLevel > 0.5) {
            riskAssessment = 'Medium risk - potential threats developing';
        } else {
            riskAssessment = 'Low risk - position is safe';
        }

        // Alternative options
        const alternativeOptions = trace.alternativeAnalysis
            .slice(0, 3)
            .map(alt => `Column ${alt.move}: ${alt.reasoning}`);

        trace.humanExplanation = {
            primaryReason,
            secondaryReasons,
            strategicGoal,
            tacticalConsiderations: [
                `Analyzed ${trace.nodesExplored} positions`,
                `Considered ${trace.legalMoves.length} legal moves`,
                `Computation time: ${trace.computationTime}ms`
            ],
            riskAssessment,
            alternativeOptions,
            skillLevel: this.determineSkillLevel(trace),
            confidence: this.mapConfidenceToHuman(confidence),
            complexity: this.determineComplexity(trace)
        };
    }

    // Helper methods for strategic analysis
    private calculateCenterControl(boardState: CellValue[][]): number {
        let centerControl = 0;
        const centerCols = [2, 3, 4]; // Center columns

        for (const col of centerCols) {
            for (let row = 0; row < 6; row++) {
                if (boardState[row][col] === 'Red') centerControl += 1;
                if (boardState[row][col] === 'Yellow') centerControl -= 1;
            }
        }

        return Math.max(0, Math.min(1, (centerControl + 18) / 36));
    }

    private calculateConnectionStrength(boardState: CellValue[][]): number {
        let connectionStrength = 0;

        // Count connected pieces
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                if (boardState[row][col] !== 'Empty') {
                    const player = boardState[row][col];

                    // Check all directions
                    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
                    for (const [dr, dc] of directions) {
                        const connected = this.countConnected(boardState, row, col, dr, dc, player);
                        connectionStrength += connected * connected; // Exponential reward for longer connections
                    }
                }
            }
        }

        return Math.min(1, connectionStrength / 100);
    }

    private calculateFlexibility(boardState: CellValue[][]): number {
        let flexibility = 0;

        // Count available moves and their potential
        for (let col = 0; col < 7; col++) {
            if (boardState[0][col] === 'Empty') {
                flexibility += 1;

                // Bonus for columns that maintain options
                if (col > 0 && col < 6) flexibility += 0.5;
                if (col >= 2 && col <= 4) flexibility += 0.3; // Center columns
            }
        }

        return Math.min(1, flexibility / 10);
    }

    private calculateTerritorialAdvantage(boardState: CellValue[][]): number {
        let redPieces = 0;
        let yellowPieces = 0;

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                if (boardState[row][col] === 'Red') redPieces++;
                if (boardState[row][col] === 'Yellow') yellowPieces++;
            }
        }

        const total = redPieces + yellowPieces;
        return total > 0 ? (redPieces - yellowPieces) / total : 0;
    }

    private calculatePieceDistribution(boardState: CellValue[][]): { [column: number]: number } {
        const distribution: { [column: number]: number } = {};

        for (let col = 0; col < 7; col++) {
            let count = 0;
            for (let row = 0; row < 6; row++) {
                if (boardState[row][col] !== 'Empty') count++;
            }
            distribution[col] = count;
        }

        return distribution;
    }

    private detectStrategicPatterns(boardState: CellValue[][]): Array<{
        pattern: string;
        strength: number;
        location: [number, number];
    }> {
        const patterns: Array<{
            pattern: string;
            strength: number;
            location: [number, number];
        }> = [];

        // Look for common patterns
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                if (boardState[row][col] !== 'Empty') {
                    const player = boardState[row][col];

                    // Check for "three in a row" patterns
                    if (this.checkDirection(boardState, row, col, 0, 1, player, 3)) {
                        patterns.push({
                            pattern: 'three_horizontal',
                            strength: 0.8,
                            location: [row, col]
                        });
                    }

                    // Check for "L" patterns
                    if (this.checkLPattern(boardState, row, col, player)) {
                        patterns.push({
                            pattern: 'L_shape',
                            strength: 0.6,
                            location: [row, col]
                        });
                    }
                }
            }
        }

        return patterns;
    }

    // Utility methods
    private checkDirection(
        board: CellValue[][],
        row: number,
        col: number,
        dr: number,
        dc: number,
        player: CellValue,
        count: number
    ): boolean {
        let connected = 0;
        for (let i = 0; i < count; i++) {
            const newRow = row + i * dr;
            const newCol = col + i * dc;
            if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 &&
                board[newRow][newCol] === player) {
                connected++;
            } else {
                break;
            }
        }
        return connected >= count;
    }

    private countConnected(
        board: CellValue[][],
        row: number,
        col: number,
        dr: number,
        dc: number,
        player: CellValue
    ): number {
        let count = 0;
        for (let i = 0; i < 4; i++) {
            const newRow = row + i * dr;
            const newCol = col + i * dc;
            if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 &&
                board[newRow][newCol] === player) {
                count++;
            } else {
                break;
            }
        }
        return count;
    }

    private checkWin(board: CellValue[][], row: number, col: number, player: CellValue): boolean {
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const [dr, dc] of directions) {
            if (this.checkDirection(board, row, col, dr, dc, player, 4)) {
                return true;
            }
        }

        return false;
    }

    private checkLPattern(board: CellValue[][], row: number, col: number, player: CellValue): boolean {
        // Check various L-shaped patterns
        const lPatterns = [
            [[0, 0], [0, 1], [1, 0]], // L top-left
            [[0, 0], [0, 1], [-1, 0]], // L bottom-left
            [[0, 0], [0, -1], [1, 0]], // L top-right
            [[0, 0], [0, -1], [-1, 0]] // L bottom-right
        ];

        for (const pattern of lPatterns) {
            let matches = 0;
            for (const [dr, dc] of pattern) {
                const newRow = row + dr;
                const newCol = col + dc;
                if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 &&
                    board[newRow][newCol] === player) {
                    matches++;
                }
            }
            if (matches === pattern.length) return true;
        }

        return false;
    }

    private async calculateThreatLevel(boardState: CellValue[][], move: number): Promise<number> {
        // Simulate the move and calculate threat level
        const simulatedBoard = boardState.map(row => [...row]);

        // Find where the piece would land
        let row = 5;
        while (row >= 0 && simulatedBoard[row][move] !== 'Empty') {
            row--;
        }

        if (row >= 0) {
            simulatedBoard[row][move] = 'Red'; // Assume player is Red

            // Count immediate threats created
            let threatLevel = 0;
            if (this.checkWin(simulatedBoard, row, move, 'Red')) {
                threatLevel = 1.0; // Winning move
            } else {
                // Check for three-in-a-row patterns
                const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
                for (const [dr, dc] of directions) {
                    if (this.checkDirection(simulatedBoard, row, move, dr, dc, 'Red', 3)) {
                        threatLevel = Math.max(threatLevel, 0.8);
                    }
                }
            }

            return threatLevel;
        }

        return 0;
    }

    private async calculateOpportunity(boardState: CellValue[][], move: number): Promise<number> {
        // Calculate opportunity value of the move
        const simulatedBoard = boardState.map(row => [...row]);

        let row = 5;
        while (row >= 0 && simulatedBoard[row][move] !== 'Empty') {
            row--;
        }

        if (row >= 0) {
            simulatedBoard[row][move] = 'Red';

            // Calculate positional value
            let opportunity = 0;

            // Center control bonus
            if (move >= 2 && move <= 4) opportunity += 0.3;

            // Connection bonus
            const connections = this.countAllConnections(simulatedBoard, row, move, 'Red');
            opportunity += connections * 0.1;

            // Setup bonus
            if (this.createsSetup(simulatedBoard, row, move, 'Red')) {
                opportunity += 0.5;
            }

            return Math.min(1, opportunity);
        }

        return 0;
    }

    private async calculateStrategicValue(boardState: CellValue[][], move: number): Promise<number> {
        // Calculate long-term strategic value
        let strategicValue = 0;

        // Positional value
        strategicValue += this.getPositionalValue(move);

        // Flexibility value
        strategicValue += this.getFlexibilityValue(boardState, move);

        // Development value
        strategicValue += this.getDevelopmentValue(boardState, move);

        return Math.min(1, strategicValue);
    }

    private async explainWhyNotSelected(
        boardState: CellValue[][],
        move: number,
        selectedMove: number
    ): Promise<string> {
        const reasons: string[] = [];

        // Compare with selected move
        const selectedThreat = await this.calculateThreatLevel(boardState, selectedMove);
        const moveThreat = await this.calculateThreatLevel(boardState, move);

        if (selectedThreat > moveThreat) {
            reasons.push('Selected move creates more immediate threats');
        }

        const selectedOpportunity = await this.calculateOpportunity(boardState, selectedMove);
        const moveOpportunity = await this.calculateOpportunity(boardState, move);

        if (selectedOpportunity > moveOpportunity) {
            reasons.push('Selected move has better positional value');
        }

        // Add specific tactical reasons
        if (this.isEdgeMove(move)) {
            reasons.push('Edge moves are generally less flexible');
        }

        if (this.createsWeakness(boardState, move)) {
            reasons.push('This move creates a positional weakness');
        }

        return reasons.join('; ') || 'Lower evaluation score';
    }

    private countAllConnections(board: CellValue[][], row: number, col: number, player: CellValue): number {
        let totalConnections = 0;
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const [dr, dc] of directions) {
            totalConnections += this.countConnected(board, row, col, dr, dc, player);
        }

        return totalConnections;
    }

    private createsSetup(board: CellValue[][], row: number, col: number, player: CellValue): boolean {
        // Check if this move creates a setup for future wins
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const [dr, dc] of directions) {
            if (this.checkDirection(board, row, col, dr, dc, player, 2)) {
                // Check if there's space for a winning connection
                const nextRow = row + 3 * dr;
                const nextCol = col + 3 * dc;
                if (nextRow >= 0 && nextRow < 6 && nextCol >= 0 && nextCol < 7) {
                    if (board[nextRow][nextCol] === 'Empty') {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private getPositionalValue(move: number): number {
        // Center columns are more valuable
        const centerValue = [0.1, 0.3, 0.5, 0.7, 0.5, 0.3, 0.1];
        return centerValue[move];
    }

    private getFlexibilityValue(board: CellValue[][], move: number): number {
        // Calculate how much flexibility this move maintains
        let flexibility = 0;

        // Check adjacent columns
        for (let col = Math.max(0, move - 1); col <= Math.min(6, move + 1); col++) {
            if (col !== move && board[0][col] === 'Empty') {
                flexibility += 0.2;
            }
        }

        return flexibility;
    }

    private getDevelopmentValue(board: CellValue[][], move: number): number {
        // Calculate development value based on piece distribution
        const distribution = this.calculatePieceDistribution(board);
        const currentHeight = distribution[move];

        // Prefer balanced development
        const averageHeight = Object.values(distribution).reduce((a, b) => a + b, 0) / 7;
        const heightDifference = Math.abs(currentHeight - averageHeight);

        return Math.max(0, 0.5 - heightDifference * 0.1);
    }

    private calculateSetupEffectiveness(board: CellValue[][], move: number): number {
        // Calculate how effective this move is as a setup
        const simulatedBoard = board.map(row => [...row]);

        let row = 5;
        while (row >= 0 && simulatedBoard[row][move] !== 'Empty') {
            row--;
        }

        if (row >= 0) {
            simulatedBoard[row][move] = 'Red';

            // Count potential future threats
            let threats = 0;
            const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

            for (const [dr, dc] of directions) {
                if (this.checkDirection(simulatedBoard, row, move, dr, dc, 'Red', 2)) {
                    threats++;
                }
            }

            return Math.min(1, threats * 0.3);
        }

        return 0;
    }

    private calculateDefenseEffectiveness(board: CellValue[][], move: number, threat: any): number {
        // Calculate how effectively this move defends against the threat
        const simulatedBoard = board.map(row => [...row]);

        let row = 5;
        while (row >= 0 && simulatedBoard[row][move] !== 'Empty') {
            row--;
        }

        if (row >= 0) {
            simulatedBoard[row][move] = 'Red';

            // Check if this blocks the threat
            const [threatRow, threatCol] = threat.position;
            const distance = Math.abs(row - threatRow) + Math.abs(move - threatCol);

            // Closer moves are more effective
            const effectiveness = Math.max(0, 1 - distance * 0.2);

            return effectiveness;
        }

        return 0;
    }

    private findCountermeasures(board: CellValue[][], row: number, col: number, dr: number, dc: number): string[] {
        const countermeasures: string[] = [];

        // Look for blocking moves
        for (let i = 0; i < 4; i++) {
            const blockRow = row + i * dr;
            const blockCol = col + i * dc;

            if (blockRow >= 0 && blockRow < 6 && blockCol >= 0 && blockCol < 7) {
                if (board[blockRow][blockCol] === 'Empty') {
                    countermeasures.push(`Block at column ${blockCol}`);
                }
            }
        }

        if (countermeasures.length === 0) {
            countermeasures.push('Create counter-threat');
        }

        return countermeasures;
    }

    private isEdgeMove(move: number): boolean {
        return move === 0 || move === 6;
    }

    private createsWeakness(board: CellValue[][], move: number): boolean {
        // Check if this move creates a weakness
        const simulatedBoard = board.map(row => [...row]);

        let row = 5;
        while (row >= 0 && simulatedBoard[row][move] !== 'Empty') {
            row--;
        }

        if (row >= 0) {
            simulatedBoard[row][move] = 'Red';

            // Check if this gives opponent a good move
            if (row > 0 && simulatedBoard[row - 1][move] === 'Empty') {
                // Check if opponent can use this position
                simulatedBoard[row - 1][move] = 'Yellow';
                if (this.checkWin(simulatedBoard, row - 1, move, 'Yellow')) {
                    return true;
                }
            }
        }

        return false;
    }

    private determineSkillLevel(trace: DecisionTrace): HumanExplanation['skillLevel'] {
        if (trace.nodesExplored > 100000) return 'expert';
        if (trace.nodesExplored > 10000) return 'advanced';
        if (trace.nodesExplored > 1000) return 'intermediate';
        return 'beginner';
    }

    private mapConfidenceToHuman(confidence: number): HumanExplanation['confidence'] {
        if (confidence >= 0.9) return 'very_high';
        if (confidence >= 0.7) return 'high';
        if (confidence >= 0.5) return 'medium';
        return 'low';
    }

    private determineComplexity(trace: DecisionTrace): HumanExplanation['complexity'] {
        let complexity = 0;

        if (trace.alternativeAnalysis.length > 5) complexity += 1;
        if (trace.threatAnalysis.threateningPositions.length > 2) complexity += 1;
        if (trace.opportunityAnalysis.setups.length > 1) complexity += 1;
        if (trace.positionalAnalysis.strategicPatterns.length > 3) complexity += 1;

        if (complexity >= 3) return 'very_complex';
        if (complexity >= 2) return 'complex';
        if (complexity >= 1) return 'moderate';
        return 'simple';
    }

    /**
     * Get recent decision traces
     */
    getRecentTraces(count = 10): DecisionTrace[] {
        return this.traces.slice(-count);
    }

    /**
     * Get traces for specific algorithm
     */
    getTracesByAlgorithm(algorithm: string): DecisionTrace[] {
        return this.traces.filter(trace => trace.algorithm === algorithm);
    }

    /**
     * Get comparative analysis between algorithms
     */
    getComparativeAnalysis(): {
        algorithms: string[];
        averageConfidence: { [algorithm: string]: number };
        averageThinkingTime: { [algorithm: string]: number };
        averageNodesExplored: { [algorithm: string]: number };
        complexityDistribution: { [algorithm: string]: { [complexity: string]: number } };
    } {
        const algorithms = [...new Set(this.traces.map(t => t.algorithm))];
        const analysis = {
            algorithms,
            averageConfidence: {} as { [algorithm: string]: number },
            averageThinkingTime: {} as { [algorithm: string]: number },
            averageNodesExplored: {} as { [algorithm: string]: number },
            complexityDistribution: {} as { [algorithm: string]: { [complexity: string]: number } }
        };

        for (const algorithm of algorithms) {
            const algorithmTraces = this.getTracesByAlgorithm(algorithm);

            analysis.averageConfidence[algorithm] =
                algorithmTraces.reduce((sum, t) => sum + t.confidence, 0) / algorithmTraces.length;

            analysis.averageThinkingTime[algorithm] =
                algorithmTraces.reduce((sum, t) => sum + t.computationTime, 0) / algorithmTraces.length;

            analysis.averageNodesExplored[algorithm] =
                algorithmTraces.reduce((sum, t) => sum + t.nodesExplored, 0) / algorithmTraces.length;

            // Complexity distribution
            const complexityCount = { simple: 0, moderate: 0, complex: 0, very_complex: 0 };
            for (const trace of algorithmTraces) {
                complexityCount[trace.humanExplanation.complexity]++;
            }
            analysis.complexityDistribution[algorithm] = complexityCount;
        }

        return analysis;
    }

    /**
     * Generate educational explanation for specific skill level
     */
    getEducationalExplanation(trace: DecisionTrace, skillLevel: HumanExplanation['skillLevel']): string {
        const explanation = trace.humanExplanation;

        switch (skillLevel) {
            case 'beginner':
                return `${explanation.primaryReason}. This is a ${explanation.complexity} decision with ${explanation.confidence} confidence.`;

            case 'intermediate':
                return `${explanation.primaryReason}. ${explanation.secondaryReasons.join(', ')}. The strategic goal is ${explanation.strategicGoal}.`;

            case 'advanced':
                return `${explanation.primaryReason}. ${explanation.secondaryReasons.join(', ')}. Strategic goal: ${explanation.strategicGoal}. Risk assessment: ${explanation.riskAssessment}. Alternative options: ${explanation.alternativeOptions.slice(0, 2).join(', ')}.`;

            case 'expert':
                return `${explanation.primaryReason}. ${explanation.secondaryReasons.join(', ')}. Strategic goal: ${explanation.strategicGoal}. Tactical considerations: ${explanation.tacticalConsiderations.join(', ')}. Risk assessment: ${explanation.riskAssessment}. Alternative options: ${explanation.alternativeOptions.join(', ')}.`;

            default:
                return explanation.primaryReason;
        }
    }

    /**
     * Clear trace history
     */
    clearHistory(): void {
        this.traces = [];
    }

    /**
     * Export traces to JSON
     */
    exportTraces(): string {
        return JSON.stringify(this.traces, null, 2);
    }

    /**
     * Import traces from JSON
     */
    importTraces(jsonData: string): void {
        try {
            const importedTraces = JSON.parse(jsonData);
            this.traces = importedTraces;
        } catch (error) {
            console.error('Failed to import traces:', error);
        }
    }
}
