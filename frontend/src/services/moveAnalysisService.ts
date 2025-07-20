// frontend/src/services/moveAnalysisService.ts
// Real AI-based move analysis service
import { MoveExplanation, StrategicInsights } from '../api/ai-insights';

// API base URL - adjust based on your backend configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

interface RealMoveAnalysis {
    move: number;
    quality: 'excellent' | 'good' | 'average' | 'poor' | 'blunder';
    score: number;
    confidence: number;
    primaryReasoning: string;
    secondaryInsights: string[];
    strategicContext: string;
    tacticalElements: string;
    alternativeMoves: Array<{
        column: number;
        score: number;
        reasoning: string;
    }>;
    aiDecision?: any;
}

interface RealPositionAnalysis {
    explanation: {
        move: number;
        quality: 'excellent' | 'good' | 'average' | 'poor' | 'blunder';
        score: number;
        confidence: number;
        primaryReasoning: string;
        secondaryInsights: string[];
        strategicContext: string;
        tacticalElements: string;
        alternativeMoves: Array<{
            column: number;
            score: number;
            reasoning: string;
        }>;
    };
    insights: {
        threats: number[];
        opportunities: number[];
        defensiveMoves: number[];
        offensiveMoves: number[];
        control: string[];
        patterns: string[];
        weaknesses: string[];
        strengths: string[];
        combinations: string[];
        traps: string[];
        counters: string[];
        bestMoves: Array<{
            column: number;
            score: number;
            reasoning: string;
            risk: 'low' | 'medium' | 'high';
        }>;
        avoidMoves: Array<{
            column: number;
            reason: string;
            risk: 'low' | 'medium' | 'high';
        }>;
        position: 'winning' | 'equal' | 'losing';
        score: number;
        complexity: 'simple' | 'moderate' | 'complex';
    };
}

class RealMoveAnalysisService {
    private explanations: Map<string, MoveExplanation> = new Map();
    private insights: Map<string, StrategicInsights> = new Map();

    /**
     * Get real AI analysis for a specific move
     */
    async getMoveExplanation(
        gameId: string,
        move: number,
        player: 'player' | 'ai',
        boardState?: string[][],
        aiLevel: number = 1
    ): Promise<MoveExplanation> {
        const cacheKey = `${gameId}-${move}-${player}`;

        if (this.explanations.has(cacheKey)) {
            return this.explanations.get(cacheKey)!;
        }

        try {
            // Call the real backend AI analysis
            const response = await fetch(`${API_BASE_URL}/games/${gameId}/analyze-move`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    column: move,
                    player,
                    aiLevel
                })
            });

            if (!response.ok) {
                throw new Error(`AI analysis failed: ${response.statusText}`);
            }

            const realAnalysis: RealMoveAnalysis = await response.json();

            // Convert real AI analysis to MoveExplanation format
            const explanation: MoveExplanation = {
                gameId,
                move,
                player,
                column: realAnalysis.move,
                explanation: {
                    primary: realAnalysis.primaryReasoning,
                    secondary: realAnalysis.secondaryInsights,
                    strategic: realAnalysis.strategicContext,
                    tactical: realAnalysis.tacticalElements
                },
                analysis: {
                    quality: realAnalysis.quality,
                    score: realAnalysis.score,
                    confidence: realAnalysis.confidence,
                    alternatives: realAnalysis.alternativeMoves.map(alt => ({
                        column: alt.column,
                        score: alt.score,
                        reasoning: alt.reasoning
                    }))
                },
                boardState: {
                    before: boardState || Array.from({ length: 6 }, () => Array(7).fill('Empty')),
                    after: boardState || Array.from({ length: 6 }, () => Array(7).fill('Empty')),
                    highlights: [realAnalysis.move]
                },
                metadata: {
                    moveNumber: move,
                    gamePhase: this.determineGamePhase(move),
                    timeSpent: realAnalysis.aiDecision?.thinkingTime || 1000,
                    aiLevel: aiLevel.toString()
                }
            };

            this.explanations.set(cacheKey, explanation);
            return explanation;

        } catch (error) {
            console.error('Failed to get real AI analysis:', error);
            // Fallback to mock data if AI is unavailable
            return this.getFallbackMoveExplanation(gameId, move, player, boardState, aiLevel);
        }
    }

    /**
     * Get real AI strategic insights for current position
     */
    async getStrategicInsights(
        boardState: string[][],
        currentPlayer: 'player' | 'ai'
    ): Promise<StrategicInsights> {
        const cacheKey = `${boardState.toString()}-${currentPlayer}`;

        if (this.insights.has(cacheKey)) {
            return this.insights.get(cacheKey)!;
        }

        try {
            // For now, we'll use the position analysis endpoint
            // In a real implementation, you might have a separate strategic insights endpoint
            const gameId = 'current-game'; // This would need to be passed from the game context

            const response = await fetch(`${API_BASE_URL}/games/${gameId}/analyze-position`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentPlayer,
                    aiLevel: 1
                })
            });

            if (!response.ok) {
                throw new Error(`Strategic analysis failed: ${response.statusText}`);
            }

            const realAnalysis: RealPositionAnalysis = await response.json();

            // Convert real AI insights to StrategicInsights format
            const insights: StrategicInsights = {
                boardState,
                currentPlayer,
                insights: {
                    immediate: {
                        threats: realAnalysis.insights.threats,
                        opportunities: realAnalysis.insights.opportunities,
                        defensiveMoves: realAnalysis.insights.defensiveMoves,
                        offensiveMoves: realAnalysis.insights.offensiveMoves
                    },
                    strategic: {
                        control: realAnalysis.insights.control,
                        patterns: realAnalysis.insights.patterns,
                        weaknesses: realAnalysis.insights.weaknesses,
                        strengths: realAnalysis.insights.strengths
                    },
                    tactical: {
                        combinations: realAnalysis.insights.combinations,
                        traps: realAnalysis.insights.traps,
                        counters: realAnalysis.insights.counters
                    }
                },
                recommendations: {
                    bestMoves: realAnalysis.insights.bestMoves,
                    avoidMoves: realAnalysis.insights.avoidMoves
                },
                evaluation: {
                    position: realAnalysis.insights.position,
                    score: realAnalysis.insights.score,
                    confidence: 0.8,
                    complexity: realAnalysis.insights.complexity
                }
            };

            this.insights.set(cacheKey, insights);
            return insights;

        } catch (error) {
            console.error('Failed to get real strategic insights:', error);
            // Fallback to mock data if AI is unavailable
            return this.getFallbackStrategicInsights(boardState, currentPlayer);
        }
    }

    /**
 * Analyze current position comprehensively using real AI
 */
    async analyzeCurrentPosition(
        boardState: string[][],
        currentPlayer: 'player' | 'ai',
        aiLevel: number = 1,
        gameId?: string,
        boardBeforeMove?: string[][],
        boardAfterMove?: string[][],
        lastMoveColumn?: number
    ): Promise<{
        explanation: MoveExplanation;
        insights: StrategicInsights;
    }> {
        try {
            const actualGameId = gameId || 'current-game'; // Use passed gameId or fallback

            const response = await fetch(`${API_BASE_URL}/games/${actualGameId}/analyze-position`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentPlayer,
                    aiLevel
                })
            });

            if (!response.ok) {
                throw new Error(`Position analysis failed: ${response.statusText}`);
            }

            const realAnalysis: RealPositionAnalysis = await response.json();

            // Convert to MoveExplanation format
            const explanation: MoveExplanation = {
                gameId: actualGameId,
                move: realAnalysis.explanation.move,
                player: currentPlayer,
                column: realAnalysis.explanation.move,
                explanation: {
                    primary: realAnalysis.explanation.primaryReasoning,
                    secondary: realAnalysis.explanation.secondaryInsights,
                    strategic: realAnalysis.explanation.strategicContext,
                    tactical: realAnalysis.explanation.tacticalElements
                },
                analysis: {
                    quality: realAnalysis.explanation.quality,
                    score: realAnalysis.explanation.score,
                    confidence: realAnalysis.explanation.confidence,
                    alternatives: realAnalysis.explanation.alternativeMoves.map(alt => ({
                        column: alt.column,
                        score: alt.score,
                        reasoning: alt.reasoning
                    }))
                },
                boardState: {
                    before: boardBeforeMove || boardState,
                    after: boardAfterMove || boardState,
                    highlights: lastMoveColumn !== undefined ? [lastMoveColumn] : [realAnalysis.explanation.move]
                },
                metadata: {
                    moveNumber: 1,
                    gamePhase: 'middlegame',
                    timeSpent: 1000,
                    aiLevel: aiLevel.toString()
                }
            };

            // Convert to StrategicInsights format
            const insights: StrategicInsights = {
                boardState,
                currentPlayer,
                insights: {
                    immediate: {
                        threats: realAnalysis.insights.threats,
                        opportunities: realAnalysis.insights.opportunities,
                        defensiveMoves: realAnalysis.insights.defensiveMoves,
                        offensiveMoves: realAnalysis.insights.offensiveMoves
                    },
                    strategic: {
                        control: realAnalysis.insights.control,
                        patterns: realAnalysis.insights.patterns,
                        weaknesses: realAnalysis.insights.weaknesses,
                        strengths: realAnalysis.insights.strengths
                    },
                    tactical: {
                        combinations: realAnalysis.insights.combinations,
                        traps: realAnalysis.insights.traps,
                        counters: realAnalysis.insights.counters
                    }
                },
                recommendations: {
                    bestMoves: realAnalysis.insights.bestMoves,
                    avoidMoves: realAnalysis.insights.avoidMoves
                },
                evaluation: {
                    position: realAnalysis.insights.position,
                    score: realAnalysis.insights.score,
                    confidence: 0.8,
                    complexity: realAnalysis.insights.complexity
                }
            };

            return { explanation, insights };

        } catch (error) {
            console.error('Failed to analyze current position with real AI:', error);
            // Fallback to mock data if AI is unavailable
            return this.getFallbackPositionAnalysis(boardState, currentPlayer, aiLevel);
        }
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.explanations.clear();
        this.insights.clear();
    }

    /**
     * Determine game phase based on move number
     */
    private determineGamePhase(moveNumber: number): 'opening' | 'middlegame' | 'endgame' {
        if (moveNumber <= 10) return 'opening';
        if (moveNumber <= 30) return 'middlegame';
        return 'endgame';
    }

    /**
     * Fallback methods for when AI is unavailable
     */
    private getFallbackMoveExplanation(
        gameId: string,
        move: number,
        player: 'player' | 'ai',
        boardState?: string[][],
        aiLevel: number = 1
    ): MoveExplanation {
        // Simple fallback with basic analysis
        return {
            gameId,
            move,
            player,
            column: move,
            explanation: {
                primary: 'AI analysis temporarily unavailable. This is a fallback explanation.',
                secondary: ['Move analysis pending', 'AI system initializing'],
                strategic: 'Strategic evaluation in progress',
                tactical: 'Tactical analysis pending'
            },
            analysis: {
                quality: 'average',
                score: 0.5,
                confidence: 0.3,
                alternatives: []
            },
            boardState: {
                before: boardState || Array.from({ length: 6 }, () => Array(7).fill('Empty')),
                after: boardState || Array.from({ length: 6 }, () => Array(7).fill('Empty')),
                highlights: [move]
            },
            metadata: {
                moveNumber: move,
                gamePhase: this.determineGamePhase(move),
                timeSpent: 1000,
                aiLevel: aiLevel.toString()
            }
        };
    }

    private getFallbackStrategicInsights(
        boardState: string[][],
        currentPlayer: 'player' | 'ai'
    ): StrategicInsights {
        return {
            boardState,
            currentPlayer,
            insights: {
                immediate: {
                    threats: [],
                    opportunities: [],
                    defensiveMoves: [],
                    offensiveMoves: []
                },
                strategic: {
                    control: ['AI analysis pending'],
                    patterns: ['Pattern recognition in progress'],
                    weaknesses: ['Weakness analysis pending'],
                    strengths: ['Strength evaluation pending']
                },
                tactical: {
                    combinations: [],
                    traps: [],
                    counters: []
                }
            },
            recommendations: {
                bestMoves: [],
                avoidMoves: []
            },
            evaluation: {
                position: 'equal',
                score: 0.5,
                confidence: 0.3,
                complexity: 'moderate'
            }
        };
    }

    private getFallbackPositionAnalysis(
        boardState: string[][],
        currentPlayer: 'player' | 'ai',
        aiLevel: number = 1
    ): { explanation: MoveExplanation; insights: StrategicInsights } {
        return {
            explanation: this.getFallbackMoveExplanation('fallback', 1, currentPlayer, boardState, aiLevel),
            insights: this.getFallbackStrategicInsights(boardState, currentPlayer)
        };
    }
}

// Export singleton instance
export const moveAnalysisService = new RealMoveAnalysisService();

// Export functions for easy use
export const getMoveExplanation = (
    gameId: string,
    move: number,
    player: 'player' | 'ai',
    boardState?: string[][],
    aiLevel?: number
): Promise<MoveExplanation> =>
    moveAnalysisService.getMoveExplanation(gameId, move, player, boardState, aiLevel);

export const getStrategicInsights = (
    boardState: string[][],
    currentPlayer: 'player' | 'ai'
): Promise<StrategicInsights> =>
    moveAnalysisService.getStrategicInsights(boardState, currentPlayer);

export const analyzeCurrentPosition = (
    boardState: string[][],
    currentPlayer: 'player' | 'ai',
    aiLevel?: number,
    gameId?: string,
    boardBeforeMove?: string[][],
    boardAfterMove?: string[][],
    lastMoveColumn?: number
): Promise<{ explanation: MoveExplanation; insights: StrategicInsights }> =>
    moveAnalysisService.analyzeCurrentPosition(boardState, currentPlayer, aiLevel, gameId, boardBeforeMove, boardAfterMove, lastMoveColumn);

export const clearMoveAnalysisCache = (): void =>
    moveAnalysisService.clearCache(); 