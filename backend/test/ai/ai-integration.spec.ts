// test/ai/ai-integration.spec.ts
import { UltimateConnect4AI } from '../../src/ai/connect4AI';
import { createMockBoard } from '../setup';

describe('Ultimate Connect Four AI Integration', () => {
    let ultimateAI: UltimateConnect4AI;

    beforeAll(async () => {
        // Initialize with testing configuration
        ultimateAI = new UltimateConnect4AI({
            primaryStrategy: 'minimax',
            neuralNetwork: {
                type: 'cnn',
                enableTraining: false,
                trainingFrequency: 100,
                batchSize: 32,
                learningRate: 0.001
            },
            performance: {
                maxThinkingTime: 2000,
                multiThreading: false,
                memoryLimit: 512,
                gpuAcceleration: false
            },
            advanced: {
                multiAgent: false,
                metaLearning: false,
                curriculumLearning: false,
                populationTraining: false,
                explainableAI: false,
                realTimeAdaptation: false
            }
        });
    });

    afterAll(() => {
        ultimateAI?.dispose();
    });

    describe('Basic AI Functionality', () => {
        test('should initialize successfully', () => {
            expect(ultimateAI).toBeDefined();
        });

        test('should make valid moves on empty board', async () => {
            const emptyBoard = createMockBoard('empty');
            const decision = await ultimateAI.getBestMove(emptyBoard as any, 'Red', 2000);

            expect(decision).toBeDefined();
            expect(decision.move).toBeGreaterThanOrEqual(0);
            expect(decision.move).toBeLessThanOrEqual(6);
            expect(decision.confidence).toBeGreaterThan(0);
            expect(decision.confidence).toBeLessThanOrEqual(1);
        });

        test('should detect winning moves', async () => {
            const threatBoard = createMockBoard('threat');
            const decision = await ultimateAI.getBestMove(threatBoard as any, 'Red', 2000);

            expect(decision.move).toBe(3); // Should play the winning move
            expect(decision.confidence).toBeGreaterThan(0.5);
        });

        test('should provide decision metadata', async () => {
            const midGameBoard = createMockBoard('midgame');
            const decision = await ultimateAI.getBestMove(midGameBoard as any, 'Red', 2000);

            expect(decision.strategy).toBeDefined();
            expect(decision.thinkingTime).toBeGreaterThan(0);
            expect(decision.reasoning).toBeDefined();
        });
    });

    describe('Strategy Switching', () => {
        test('should switch between strategies', async () => {
            const board = createMockBoard('empty');

            // Test minimax
            ultimateAI.updateConfig({ primaryStrategy: 'minimax' });
            const minimaxDecision = await ultimateAI.getBestMove(board as any, 'Red', 1000);
            expect(minimaxDecision.strategy).toContain('minimax');

            // Test MCTS
            ultimateAI.updateConfig({ primaryStrategy: 'mcts' });
            const mctsDecision = await ultimateAI.getBestMove(board as any, 'Red', 1000);
            expect(mctsDecision.strategy).toContain('mcts');
        });
    });

    describe('Performance Metrics', () => {
        test('should provide AI metrics', () => {
            const metrics = ultimateAI.getAIMetrics();

            expect(metrics).toBeDefined();
            expect(metrics.strategy).toBeDefined();
            expect(metrics.performance).toBeDefined();
        });

        test('should complete moves within time limit', async () => {
            const board = createMockBoard('midgame');
            const timeLimit = 1000;

            const startTime = Date.now();
            const decision = await ultimateAI.getBestMove(board as any, 'Red', timeLimit);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(timeLimit + 500); // Small buffer
            expect(decision.thinkingTime).toBeLessThan(timeLimit + 200);
        });
    });

    describe('Edge Cases', () => {
        test('should handle nearly full board', async () => {
            const nearlyFullBoard = [
                ['Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Empty'],
                ['Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Empty'],
                ['Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Empty'],
                ['Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Empty'],
                ['Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Empty'],
                ['Yellow', 'Red', 'Yellow', 'Red', 'Yellow', 'Red', 'Empty']
            ];

            const decision = await ultimateAI.getBestMove(nearlyFullBoard as any, 'Red', 2000);
            expect(decision.move).toBe(6); // Only legal move
        });

        test('should maintain consistency for same position', async () => {
            const board = createMockBoard('threat');
            const decisions = [];

            for (let i = 0; i < 3; i++) {
                const decision = await ultimateAI.getBestMove(board as any, 'Red', 1000);
                decisions.push(decision.move);
            }

            // Should consistently find the winning move
            expect(decisions.every(move => move === 3)).toBe(true);
        });
    });

    describe('Configuration Updates', () => {
        test('should update configuration dynamically', () => {
            ultimateAI.updateConfig({
                primaryStrategy: 'hybrid',
                performance: {
                    maxThinkingTime: 5000,
                    multiThreading: false,
                    memoryLimit: 512,
                    gpuAcceleration: false
                }
            });

            const metrics = ultimateAI.getAIMetrics();
            expect(metrics.strategy).toBe('hybrid');
        });
    });

    describe('Game Simulation', () => {
        test('should complete a simple game', async () => {
            const board = createMockBoard('empty');
            let currentPlayer: 'Red' | 'Yellow' = 'Red';
            let moves = 0;

            // Play a few moves
            while (moves < 10) {
                const decision = await ultimateAI.getBestMove(board as any, currentPlayer, 1000);

                // Make the move
                const col = decision.move;
                let placed = false;

                for (let row = 5; row >= 0; row--) {
                    if (board[row][col] === 'Empty') {
                        board[row][col] = currentPlayer;
                        placed = true;
                        break;
                    }
                }

                if (!placed) break; // Column full

                moves++;
                currentPlayer = currentPlayer === 'Red' ? 'Yellow' : 'Red';
            }

            expect(moves).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid moves gracefully', async () => {
            const board = createMockBoard('empty');

            // Fill a column completely
            for (let row = 0; row < 6; row++) {
                board[row][0] = 'Red';
            }

            const decision = await ultimateAI.getBestMove(board as any, 'Red', 1000);

            // Should not choose the filled column
            expect(decision.move).not.toBe(0);
            expect(decision.move).toBeGreaterThan(0);
            expect(decision.move).toBeLessThanOrEqual(6);
        });
    });
});

// Helper function to check for wins
function checkWin(board: any[][], player: string): boolean {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7; col++) {
            if (board[row][col] !== player) continue;

            for (const [dr, dc] of directions) {
                let count = 1;
                for (let i = 1; i < 4; i++) {
                    const newRow = row + i * dr;
                    const newCol = col + i * dc;
                    if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 &&
                        board[newRow][newCol] === player) {
                        count++;
                    } else {
                        break;
                    }
                }
                if (count >= 4) return true;
            }
        }
    }

    return false;
}

// Mock AI vs AI test
describe('AI vs AI Simulation', () => {
    test('should handle AI vs AI gameplay', async () => {
        const ai1 = new UltimateConnect4AI({ primaryStrategy: 'minimax' });
        const ai2 = new UltimateConnect4AI({ primaryStrategy: 'mcts' });

        const board = createMockBoard('empty');
        let currentPlayer: 'Red' | 'Yellow' = 'Red';
        let moves = 0;
        let gameWon = false;

        while (moves < 42 && !gameWon) {
            const ai = currentPlayer === 'Red' ? ai1 : ai2;
            const decision = await ai.getBestMove(board as any, currentPlayer, 1000);

            // Make move
            const col = decision.move;
            let placed = false;

            for (let row = 5; row >= 0; row--) {
                if (board[row][col] === 'Empty') {
                    board[row][col] = currentPlayer;
                    placed = true;
                    break;
                }
            }

            if (!placed) break; // Column full

            moves++;

            // Check for win
            if (checkWin(board, currentPlayer)) {
                gameWon = true;
            }

            currentPlayer = currentPlayer === 'Red' ? 'Yellow' : 'Red';
        }

        expect(moves).toBeGreaterThan(0);
        expect(moves).toBeLessThanOrEqual(42);

        ai1.dispose();
        ai2.dispose();
    }, 30000);
}); 