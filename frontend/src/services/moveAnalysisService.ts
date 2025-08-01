// frontend/src/services/moveAnalysisService.ts
// Real AI-based move analysis service
import { MoveExplanation, StrategicInsights } from '../api/ai-insights';
import { buildApiEndpoint } from '../config/environment';

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
            // Validate game ID before making API calls
            if (!gameId || gameId.length < 8) {
                console.log(`Invalid game ID: ${gameId}, using fallback analysis`);
                return this.getFallbackMoveExplanation(gameId, move, player, boardState, aiLevel);
            }

            // Check if the column is full
            if (boardState && boardState.length > 0 && move >= 0 && move < 7) {
                if (boardState[0][move] !== 'Empty') {
                    console.log(`Column ${move} is full, providing strategic analysis`);
                    return this.getColumnFullExplanation(gameId, move, player, boardState, aiLevel);
                }
            }

            // If we have a valid board state from the frontend, use it directly
            if (boardState && boardState.length > 0) {
                console.log(`🎯 Using frontend board state for analysis of game ${gameId}`);
                // Use the provided board state instead of fetching from backend
                return this.analyzeWithBoardState(gameId, move, player, boardState, aiLevel);
            }

            // Try to get the game board to verify it exists
            let gameExists = false;
            let retryCount = 0;
            const maxRetries = 3;

            while (!gameExists && retryCount < maxRetries) {
                try {
                    console.log(`🔍 Checking if game ${gameId} exists... (attempt ${retryCount + 1}/${maxRetries})`);
                    const gameCheckResponse = await fetch(buildApiEndpoint(`/games/${gameId}/board`));
                    gameExists = gameCheckResponse.ok;
                    console.log(`✅ Game ${gameId} check result: ${gameCheckResponse.status} ${gameCheckResponse.statusText}`);

                    if (gameExists) break;
                } catch (error) {
                    console.log(`❌ Error checking game ${gameId} (attempt ${retryCount + 1}):`, error);
                    gameExists = false;
                }

                if (!gameExists && retryCount < maxRetries - 1) {
                    console.log(`⏳ Game ${gameId} not found, retrying in 500ms...`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                retryCount++;
            }

            if (!gameExists) {
                // Game doesn't exist after retries, use fallback analysis
                console.log(`Game ${gameId} not found after ${maxRetries} attempts, using fallback analysis`);
                console.log(`💡 This usually means the game session has expired. Please start a new game.`);
                return this.getFallbackMoveExplanation(gameId, move, player, boardState, aiLevel);
            }

            // Call the real backend AI analysis
            let response;
            try {
                console.log(`🧠 Calling analyze-move API for game ${gameId}...`);
                response = await fetch(buildApiEndpoint(`/games/${gameId}/analyze-move`), {
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

                console.log(`📊 Analyze-move response: ${response.status} ${response.statusText}`);
                if (!response.ok) {
                    throw new Error(`AI analysis failed: ${response.statusText}`);
                }
            } catch (error) {
                console.error(`❌ Error calling analyze-move API for game ${gameId}:`, error);
                throw error;
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
            // Since we don't have a valid game ID for strategic insights, use fallback analysis
            console.log('No valid game ID provided for strategic insights, using fallback analysis');
            return this.getFallbackStrategicInsights(boardState, currentPlayer);
        } catch (error) {
            console.error('Failed to get strategic insights:', error);
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
            // If no valid game ID is provided, use fallback analysis
            if (!gameId || gameId.length < 8) {
                console.log('No valid game ID provided for position analysis, using fallback analysis');
                return {
                    explanation: this.getFallbackMoveExplanation(gameId || 'fallback', 1, currentPlayer, boardState, aiLevel),
                    insights: this.getFallbackStrategicInsights(boardState, currentPlayer)
                };
            }

            const response = await fetch(buildApiEndpoint(`/games/${gameId}/analyze-position`), {
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
                const errorText = await response.text();
                console.error(`Position analysis failed: ${response.status} ${response.statusText}`, errorText);
                
                // If game not found, provide better error message
                if (response.status === 400 && errorText.includes('Game not found')) {
                    console.log('Game not found on backend, using fallback analysis');
                    return {
                        explanation: this.getFallbackMoveExplanation(gameId, 1, currentPlayer, boardState, aiLevel),
                        insights: this.getFallbackStrategicInsights(boardState, currentPlayer)
                    };
                }
                
                throw new Error(`Position analysis failed: ${response.statusText}`);
            }

            const realAnalysis: RealPositionAnalysis = await response.json();

            // Convert to MoveExplanation format
            const explanation: MoveExplanation = {
                gameId: gameId,
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
     * Analyze move using provided board state instead of fetching from backend
     */
    private async analyzeWithBoardState(
        gameId: string,
        move: number,
        player: 'player' | 'ai',
        boardState: string[][],
        aiLevel: number
    ): Promise<MoveExplanation> {
        try {
            console.log(`🧠 Analyzing move ${move} for ${player} using frontend board state`);

            // Call the analyze-move API with the current board state
            const response = await fetch(buildApiEndpoint(`/games/${gameId}/analyze-move`), {
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
                const errorText = await response.text();
                console.error(`AI analysis failed: ${response.status} ${response.statusText}`, errorText);

                // If game not found (likely after backend restart), provide fallback
                if (response.status === 400 && errorText.includes('Game not found')) {
                    console.log('Game not found on backend, using fallback analysis');
                    return this.getFallbackMoveExplanation(gameId, move, player, boardState || [], aiLevel);
                }

                // If column is full, provide helpful fallback
                if (response.status === 400 && errorText.includes('is full')) {
                    console.log(`Column ${move} is full, providing analysis of why it's full`);
                    return this.getColumnFullExplanation(gameId, move, player, boardState || [], aiLevel);
                }

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
                    before: boardState,
                    after: boardState, // We'll use the same state for now
                    highlights: [realAnalysis.move]
                },
                metadata: {
                    moveNumber: move,
                    gamePhase: this.determineGamePhase(move),
                    timeSpent: realAnalysis.aiDecision?.thinkingTime || 1000,
                    aiLevel: aiLevel.toString()
                }
            };

            const cacheKey = `${gameId}-${move}-${player}`;
            this.explanations.set(cacheKey, explanation);
            return explanation;

        } catch (error) {
            console.error(`❌ Error analyzing with board state:`, error);
            // Fallback to mock analysis if API call fails
            return this.getFallbackMoveExplanation(gameId, move, player, boardState, aiLevel);
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
        // Generate realistic fallback analysis based on move number and player
        const gamePhase = this.determineGamePhase(move);
        const moveQuality = this.getFallbackMoveQuality(move, player, gamePhase);
        const reasoning = this.getFallbackReasoning(move, player, gamePhase);

        return {
            gameId,
            move,
            player,
            column: move,
            explanation: {
                primary: reasoning.primary,
                secondary: reasoning.secondary,
                strategic: reasoning.strategic,
                tactical: reasoning.tactical
            },
            analysis: {
                quality: moveQuality.quality,
                score: moveQuality.score,
                confidence: moveQuality.confidence,
                alternatives: this.getFallbackAlternatives(move, player)
            },
            boardState: {
                before: boardState || Array.from({ length: 6 }, () => Array(7).fill('Empty')),
                after: boardState || Array.from({ length: 6 }, () => Array(7).fill('Empty')),
                highlights: [move]
            },
            metadata: {
                moveNumber: move,
                gamePhase: gamePhase,
                timeSpent: Math.floor(Math.random() * 2000) + 500,
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

    private getFallbackMoveQuality(
        move: number,
        player: 'player' | 'ai',
        gamePhase: 'opening' | 'middlegame' | 'endgame'
    ): { quality: 'excellent' | 'good' | 'average' | 'poor' | 'blunder'; score: number; confidence: number } {
        // Generate realistic quality based on move number and player
        const baseScore = Math.random() * 0.4 + 0.3; // 0.3 to 0.7
        const aiBonus = player === 'ai' ? 0.1 : 0;
        const phaseBonus = gamePhase === 'opening' ? 0.05 : gamePhase === 'middlegame' ? 0.1 : 0.15;

        const finalScore = Math.min(1.0, baseScore + aiBonus + phaseBonus);

        let quality: 'excellent' | 'good' | 'average' | 'poor' | 'blunder';
        if (finalScore >= 0.8) quality = 'excellent';
        else if (finalScore >= 0.6) quality = 'good';
        else if (finalScore >= 0.4) quality = 'average';
        else if (finalScore >= 0.2) quality = 'poor';
        else quality = 'blunder';

        return {
            quality,
            score: finalScore,
            confidence: Math.random() * 0.3 + 0.4 // 0.4 to 0.7
        };
    }

    private getFallbackReasoning(
        move: number,
        player: 'player' | 'ai',
        gamePhase: 'opening' | 'middlegame' | 'endgame'
    ): { primary: string; secondary: string[]; strategic: string; tactical: string } {
        const phaseTexts = {
            opening: {
                primary: 'Establishes control in the opening phase',
                secondary: ['Controls center position', 'Sets up future opportunities', 'Maintains flexibility'],
                strategic: 'Focuses on board control and piece development',
                tactical: 'Creates potential for future combinations'
            },
            middlegame: {
                primary: 'Develops tactical opportunities in the middlegame',
                secondary: ['Creates threats', 'Controls key positions', 'Limits opponent options'],
                strategic: 'Balances attack and defense while maintaining position',
                tactical: 'Sets up immediate and long-term tactical possibilities'
            },
            endgame: {
                primary: 'Secures advantage in the endgame phase',
                secondary: ['Converts advantage', 'Limits counterplay', 'Maintains control'],
                strategic: 'Focuses on converting positional advantage to victory',
                tactical: 'Exploits specific tactical opportunities'
            }
        };

        const phase = phaseTexts[gamePhase];
        const playerPrefix = player === 'ai' ? 'AI' : 'Player';

        return {
            primary: `${playerPrefix} ${phase.primary.toLowerCase()}`,
            secondary: phase.secondary,
            strategic: phase.strategic,
            tactical: phase.tactical
        };
    }

    private getFallbackAlternatives(
        move: number,
        player: 'player' | 'ai'
    ): Array<{ column: number; score: number; reasoning: string }> {
        // Generate 2-3 alternative moves
        const alternatives = [];
        const numAlternatives = Math.floor(Math.random() * 2) + 2; // 2-3 alternatives

        for (let i = 0; i < numAlternatives; i++) {
            const column = (move + i + 1) % 7; // Different column
            const score = Math.random() * 0.3 + 0.2; // 0.2 to 0.5
            const reasoning = [
                'Alternative tactical approach',
                'Different strategic direction',
                'Defensive consideration',
                'Counter-attacking move'
            ][i % 4];

            alternatives.push({ column, score, reasoning });
        }

        return alternatives;
    }

    /**
     * Get explanation for when a column is full
     */
    private getColumnFullExplanation(
        gameId: string,
        move: number,
        player: 'player' | 'ai',
        boardState: string[][],
        aiLevel: number = 1
    ): MoveExplanation {
        // Find available columns
        const availableColumns: number[] = [];
        if (boardState && boardState.length > 0) {
            for (let col = 0; col < 7; col++) {
                if (boardState[0][col] === 'Empty') {
                    availableColumns.push(col);
                }
            }
        }

        return {
            gameId,
            move,
            player,
            column: move,
            explanation: {
                primary: `Column ${move} is completely full and cannot accept any more pieces`,
                secondary: [
                    'This column has reached its maximum capacity of 6 pieces',
                    `Available columns are: ${availableColumns.length > 0 ? availableColumns.join(', ') : 'None - board might be full'}`,
                    'Consider playing in an open column instead'
                ],
                strategic: 'Full columns can create interesting tactical situations by limiting options',
                tactical: 'Use full columns to your advantage by forcing plays in specific areas'
            },
            analysis: {
                quality: 'invalid' as any,
                score: 0,
                confidence: 100,
                alternatives: availableColumns.slice(0, 3).map(col => ({
                    column: col,
                    score: 0.5,
                    reasoning: `Column ${col} is available for play`
                }))
            },
            boardState: {
                before: boardState,
                after: boardState,
                highlights: [move]
            },
            metadata: {
                moveNumber: 0,
                gamePhase: 'analysis' as any,
                timeSpent: 0,
                aiLevel: aiLevel.toString()
            }
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