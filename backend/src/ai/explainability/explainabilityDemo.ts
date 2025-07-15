// src/ai/explainability/explainabilityDemo.ts
import { CellValue, AIDecision } from '../connect4AI';
import { DecisionTracer } from './decisionTracer';
import { FeatureImportanceAnalyzer } from './featureImportance';
import { SaliencyMapGenerator } from './saliencyMaps';

/**
 * Comprehensive AI Explainability Demo
 * 
 * This demonstrates how to use all three explainability components together:
 * 1. Decision Tracer - Traces and analyzes AI decisions
 * 2. Feature Importance - Analyzes which features are most important
 * 3. Saliency Maps - Generates visual attention maps
 */
export class ExplainabilityDemo {
    private decisionTracer: DecisionTracer;
    private featureImportanceAnalyzer: FeatureImportanceAnalyzer;
    private saliencyMapGenerator: SaliencyMapGenerator;

    constructor() {
        this.decisionTracer = new DecisionTracer();
        this.featureImportanceAnalyzer = new FeatureImportanceAnalyzer({
            method: 'permutation',
            samplingSize: 50,
            perturbationStrength: 0.1
        });
        this.saliencyMapGenerator = new SaliencyMapGenerator({
            method: 'gradient',
            colorScheme: 'heat',
            spatialSmoothing: true,
            temporalSmoothing: true
        });
    }

    /**
     * Comprehensive analysis of an AI decision
     */
    async analyzeDecision(
        boardState: CellValue[][],
        decision: AIDecision,
        algorithm: string,
        decisionFunction: (board: CellValue[][]) => Promise<{ move: number; score: number }>
    ) {
        console.log(`🔍 Starting comprehensive analysis for ${algorithm} decision...`);

        // 1. Trace the decision
        const trace = await this.decisionTracer.traceDecision(
            algorithm,
            boardState,
            decision
        );

        console.log(`📊 Decision traced: ${trace.selectedMove} (confidence: ${trace.confidence.toFixed(3)})`);

        // 2. Analyze feature importance
        const featureImportance = await this.featureImportanceAnalyzer.calculateFeatureImportance(
            boardState,
            decision.move,
            algorithm,
            decisionFunction,
            trace
        );

        console.log(`🎯 Feature importance calculated: ${featureImportance.totalFeatures} features analyzed`);
        console.log(`📈 Top 5 features:`);
        featureImportance.topFeatures.slice(0, 5).forEach((feature, i) => {
            console.log(`  ${i + 1}. ${feature.featureName}: ${feature.importance.toFixed(3)} (${feature.category})`);
        });

        // 3. Generate saliency map
        const saliencyMap = await this.saliencyMapGenerator.generateSaliencyMap(
            boardState,
            decision.move,
            algorithm,
            decisionFunction,
            trace,
            featureImportance
        );

        console.log(`🎨 Saliency map generated: ${saliencyMap.focusRegions.length} focus regions detected`);
        console.log(`📍 Focus regions:`);
        saliencyMap.focusRegions.forEach((region, i) => {
            console.log(`  ${i + 1}. ${region.type}: ${region.description} (intensity: ${region.intensity.toFixed(3)})`);
        });

        // 4. Generate comprehensive report
        const report = this.generateComprehensiveReport(trace, featureImportance, saliencyMap);

        return {
            trace,
            featureImportance,
            saliencyMap,
            report
        };
    }

    /**
     * Generate a comprehensive explainability report
     */
    private generateComprehensiveReport(
        trace: any,
        featureImportance: any,
        saliencyMap: any
    ): string {
        const report = `
=== AI Decision Explainability Report ===

Algorithm: ${trace.algorithm}
Move Selected: Column ${trace.selectedMove}
Confidence: ${trace.confidence.toFixed(3)}
Computation Time: ${trace.computationTime}ms

--- Decision Reasoning ---
Primary: ${trace.humanExplanation?.primaryReason || 'Analysis in progress'}
Strategic Goal: ${trace.humanExplanation?.strategicGoal || 'Not specified'}

--- Feature Analysis ---
Total Features: ${featureImportance.totalFeatures}
Dominant Category: ${featureImportance.analysis.dominantCategory}
Focus Score: ${featureImportance.analysis.focusScore.toFixed(3)}

Top 5 Most Important Features:
${featureImportance.topFeatures.slice(0, 5).map((f: any, i: number) =>
            `${i + 1}. ${f.featureName} (${f.importance.toFixed(3)}) - ${f.description}`
        ).join('\n')}

--- Saliency Analysis ---
Method: ${saliencyMap.method}
Max Intensity: ${saliencyMap.statistics.maxIntensity.toFixed(3)}
Focus Score: ${saliencyMap.statistics.focusScore.toFixed(3)}
Coverage: ${(saliencyMap.statistics.coveragePercentage * 100).toFixed(1)}%

Focus Regions:
${saliencyMap.focusRegions.map((r: any, i: number) =>
            `${i + 1}. ${r.type.toUpperCase()}: ${r.description} (intensity: ${r.intensity.toFixed(3)})`
        ).join('\n')}

--- Threat Analysis ---
Immediate Threats: ${trace.threatAnalysis?.immediateThreat ? 'YES' : 'NO'}
Threat Level: ${trace.threatAnalysis?.threatLevel?.toFixed(3) || 'Unknown'}

--- Opportunity Analysis ---
Winning Move: ${trace.opportunityAnalysis?.winningMove ? 'YES' : 'NO'}
Setup Opportunities: ${trace.opportunityAnalysis?.setups?.length || 0}

--- Alternative Moves ---
${trace.alternativeAnalysis?.slice(0, 3).map((alt: any, i: number) =>
            `${i + 1}. Column ${alt.move} (score: ${alt.score.toFixed(0)}) - ${alt.reasoning}`
        ).join('\n')}

--- Confidence Assessment ---
Overall Confidence: ${((trace.confidence + saliencyMap.confidence) / 2).toFixed(3)}
Explanation Quality: ${trace.humanExplanation?.complexity || 'Unknown'}
`;

        return report;
    }

    /**
     * Generate visual HTML report
     */
    generateVisualReport(
        trace: any,
        featureImportance: any,
        saliencyMap: any
    ): string {
        const boardVisualization = this.generateBoardVisualization(trace.boardState, saliencyMap);
        const featureChart = this.generateFeatureChart(featureImportance);

        return `
<!DOCTYPE html>
<html>
<head>
    <title>AI Decision Explainability Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .board { display: grid; grid-template-columns: repeat(7, 50px); gap: 2px; }
        .cell { width: 50px; height: 50px; border: 1px solid #333; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .feature-item { margin: 5px 0; padding: 5px; background: #f5f5f5; border-radius: 3px; }
        .stats { display: flex; gap: 20px; }
        .stat { text-align: center; padding: 10px; background: #e9e9e9; border-radius: 5px; }
        .threat { color: #d32f2f; }
        .opportunity { color: #2e7d32; }
        .strategic { color: #1976d2; }
        .tactical { color: #f57c00; }
        .pattern { color: #7b1fa2; }
        .high-importance { background: #ffeb3b; }
        .medium-importance { background: #fff3c4; }
        .low-importance { background: #fafafa; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 AI Decision Explainability Report</h1>
        
        <div class="section">
            <h2>📊 Decision Summary</h2>
            <div class="stats">
                <div class="stat">
                    <div><strong>Move</strong></div>
                    <div>Column ${trace.selectedMove}</div>
                </div>
                <div class="stat">
                    <div><strong>Confidence</strong></div>
                    <div>${trace.confidence.toFixed(3)}</div>
                </div>
                <div class="stat">
                    <div><strong>Time</strong></div>
                    <div>${trace.computationTime}ms</div>
                </div>
                <div class="stat">
                    <div><strong>Algorithm</strong></div>
                    <div>${trace.algorithm}</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🎯 Board Analysis</h2>
            ${boardVisualization}
        </div>

        <div class="section">
            <h2>🔍 Feature Importance</h2>
            ${featureChart}
        </div>

        <div class="section">
            <h2>🎨 Saliency Map</h2>
            ${this.saliencyMapGenerator.generateVisualization(saliencyMap)}
        </div>

        <div class="section">
            <h2>💭 Human Explanation</h2>
            <p><strong>Primary Reason:</strong> ${trace.humanExplanation?.primaryReason || 'Analysis in progress'}</p>
            <p><strong>Strategic Goal:</strong> ${trace.humanExplanation?.strategicGoal || 'Not specified'}</p>
            <p><strong>Risk Assessment:</strong> ${trace.humanExplanation?.riskAssessment || 'Unknown'}</p>
        </div>

        <div class="section">
            <h2>⚡ Focus Regions</h2>
            ${saliencyMap.focusRegions.map((region: any) => `
                <div class="feature-item ${region.type}">
                    <strong>${region.type.toUpperCase()}</strong>: ${region.description}
                    <br><small>Intensity: ${region.intensity.toFixed(3)}, Confidence: ${region.confidence.toFixed(3)}</small>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
`;
    }

    private generateBoardVisualization(boardState: CellValue[][], saliencyMap: any): string {
        let html = '<div class="board">';

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                const cell = boardState[row][col];
                const intensity = saliencyMap.heatMap[row][col];
                const opacity = intensity * 0.7;

                const cellColor = cell === 'Red' ? '#ff0000' :
                    cell === 'Yellow' ? '#ffff00' : '#ffffff';
                const overlayColor = `rgba(255, 165, 0, ${opacity})`;

                html += `
                    <div class="cell" style="background: linear-gradient(${overlayColor}, ${cellColor});">
                        ${cell === 'Empty' ? '' : cell.charAt(0)}
                    </div>
                `;
            }
        }

        html += '</div>';
        return html;
    }

    private generateFeatureChart(featureImportance: any): string {
        let html = '<div class="features">';

        featureImportance.topFeatures.slice(0, 10).forEach((feature: any, i: number) => {
            const importanceClass = feature.importance > 0.7 ? 'high-importance' :
                feature.importance > 0.4 ? 'medium-importance' : 'low-importance';

            html += `
                <div class="feature-item ${importanceClass}">
                    <strong>${i + 1}. ${feature.featureName}</strong>
                    <span style="float: right;">${feature.importance.toFixed(3)}</span>
                    <br><small>${feature.description} (${feature.category})</small>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    /**
     * Run a complete demo
     */
    async runDemo() {
        console.log('🚀 Starting AI Explainability Demo...\n');

        // Create a sample board state
        const boardState: CellValue[][] = [
            ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
            ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
            ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
            ['Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty', 'Empty'],
            ['Empty', 'Yellow', 'Red', 'Red', 'Empty', 'Empty', 'Empty'],
            ['Yellow', 'Yellow', 'Red', 'Yellow', 'Red', 'Empty', 'Empty']
        ];

        // Create a sample decision
        const decision: AIDecision = {
            move: 3,
            confidence: 0.85,
            reasoning: 'Blocks opponent winning threat',
            strategy: 'Defensive',
            thinkingTime: 1250,
            nodesExplored: 15000,
            metadata: {
                mctsStatistics: {
                    simulations: 15000,
                    averageDepth: 8,
                    bestLine: [3, 2, 4, 1]
                },
                neuralNetworkEvaluation: {
                    policy: [0.1, 0.2, 0.3, 0.4, 0.0, 0.0, 0.0],
                    value: 750,
                    confidence: 0.85
                }
            },
            alternativeMoves: [
                { move: 2, score: 500, reasoning: 'Defensive move' },
                { move: 4, score: 400, reasoning: 'Attacking move' },
                { move: 1, score: 300, reasoning: 'Positional move' }
            ]
        };

        // Simple decision function for demo
        const decisionFunction = async (board: CellValue[][]): Promise<{ move: number; score: number }> => {
            // Simplified evaluation - just return a random score
            return { move: Math.floor(Math.random() * 7), score: Math.random() * 1000 };
        };

        try {
            const analysis = await this.analyzeDecision(
                boardState,
                decision,
                'Enhanced Minimax',
                decisionFunction
            );

            console.log('\n' + '='.repeat(60));
            console.log('📋 COMPREHENSIVE ANALYSIS COMPLETE');
            console.log('='.repeat(60));
            console.log(analysis.report);

            // Generate and save HTML report
            const htmlReport = this.generateVisualReport(
                analysis.trace,
                analysis.featureImportance,
                analysis.saliencyMap
            );

            console.log('\n✅ Demo completed successfully!');
            console.log('📄 HTML report generated (can be saved to file)');
            console.log('🎯 All three explainability systems working together');

            return {
                success: true,
                analysis,
                htmlReport
            };

        } catch (error) {
            console.error('❌ Demo failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export for easy testing
export default ExplainabilityDemo; 