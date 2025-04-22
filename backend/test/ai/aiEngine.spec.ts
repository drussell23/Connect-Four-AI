import { getBestAIMove } from '../../src/ai/aiEngine';
import { minimax, Node } from '../../src/ai/minimax';
import { mcts } from '../../src/ai/mcts';
import { legalMoves } from '../../src/ai/utils';
import type { CellValue } from '../../src/ai/types';

// Mock dependencies
jest.mock('../../src/ai/minimax');
jest.mock('../../src/ai/mcts');
jest.mock('../../src/ai/utils');

const mockMinimax = minimax as jest.MockedFunction<typeof minimax>;
const mockMcts = mcts as jest.MockedFunction<typeof mcts>;
const mockLegalMoves = legalMoves as jest.MockedFunction<typeof legalMoves>;

// Helper to stub a board with given empty count
function makeBoardWithEmptyCount(emptyCount: number): CellValue[][] {
    const total = 6 * 7;
    const cells = Array(total).fill('Empty' as CellValue);
    for (let i = 0; i < total - emptyCount; i++) cells[i] = 'Red';
    return Array.from({ length: 6 }, (_, r) =>
        cells.slice(r * 7, r * 7 + 7)
    );
}

describe('getBestAIMove', () => {
    const emptyBoard: CellValue[][] = Array.from({ length: 6 }, () =>
        Array(7).fill('Empty' as CellValue)
    );
    const aiDisc: CellValue = 'Red';

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('uses minimax when legal moves ≤ 5 even if board mostly empty', () => {
        const board = emptyBoard;
        mockLegalMoves.mockReturnValue([0, 1, 2, 3, 4]); // ≤5 moves
        const fakeNode: Node = { column: 2, score: 0 };
        mockMinimax.mockReturnValue(fakeNode);

        const col = getBestAIMove(board, aiDisc);
        expect(mockMinimax).toHaveBeenCalled();
        expect(mockMcts).not.toHaveBeenCalled();
        expect(col).toBe(2);
    });

    it('uses mcts when > 60% empty and > 5 legal moves', () => {
        // emptyBoard has 42 empties (>25.2)
        mockLegalMoves.mockReturnValue([0, 1, 2, 3, 4, 5, 6]);
        mockMcts.mockReturnValue(5);

        const col = getBestAIMove(emptyBoard, aiDisc, 150);
        expect(mockMcts).toHaveBeenCalledWith(emptyBoard, aiDisc, 150);
        expect(mockMinimax).not.toHaveBeenCalled();
        expect(col).toBe(5);
    });

    it('falls back to minimax in mid-game when >5 moves but ≤60% empty', () => {
        const midBoard = makeBoardWithEmptyCount(20); // 20 empties < 25.2
        mockLegalMoves.mockReturnValue([0, 1, 2, 3, 4, 5, 6]);
        const fakeNode: Node = { column: 4, score: 0 };
        mockMinimax.mockReturnValue(fakeNode);

        const col = getBestAIMove(midBoard, aiDisc);
        expect(mockMcts).not.toHaveBeenCalled();
        expect(mockMinimax).toHaveBeenCalled();
        expect(col).toBe(4);
    });

    it('chooses random legal move if minimax returns invalid column', () => {
        mockLegalMoves.mockReturnValue([2, 3]);
        mockMinimax.mockReturnValue({ column: null, score: 0 });

        const col = getBestAIMove(emptyBoard, aiDisc);
        expect([2, 3]).toContain(col);
    });

    it('defaults timeMs to 200 for mcts when not passed', () => {
        mockLegalMoves.mockReturnValue([0, 1, 2, 3, 4, 5, 6]);
        mockMcts.mockReturnValue(0);
        const spy = mockMcts;

        getBestAIMove(emptyBoard, aiDisc);
        expect(spy).toHaveBeenCalledWith(emptyBoard, aiDisc, 200);
    });

    it('returns the only legal move when only one option exists', () => {
        mockLegalMoves.mockReturnValue([3]);
        mockMinimax.mockReturnValue({ column: 3, score: 0 });
        const col = getBestAIMove(emptyBoard, aiDisc);
        expect(col).toBe(3);
    });
});
