import { evaluateWindow, evaluateBoard } from '../../src/ai/evaluate';
import { CellValue } from '../../src/ai/types';

describe('evaluateWindow', () => {
    it('returns 0 for empty window', () => {
        const emptyWindow: CellValue[] = ['Empty', 'Empty', 'Empty', 'Empty'];
        expect(evaluateWindow(emptyWindow, 'Red')).toBe(0);
        expect(evaluateWindow(emptyWindow, 'Yellow')).toBe(0);
    });

    it('scores AI two and three in a row correctly', () => {
        expect(evaluateWindow(['Red', 'Red', 'Empty', 'Empty'], 'Red')).toBe(2);
        expect(evaluateWindow(['Empty', 'Red', 'Red', 'Red'], 'Red')).toBe(5 + 2);
    });

    it('scores opponent windows negatively with scaling', () => {
        expect(evaluateWindow(['Yellow', 'Yellow', 'Empty', 'Empty'], 'Red')).toBe(-(2 * 1.5));
        expect(evaluateWindow(['Yellow', 'Yellow', 'Yellow', 'Empty'], 'Red')).toBe(-(5 * 1.5));
    });

    it('scores four opponent discs as heavy penalty', () => {
        expect(evaluateWindow(['Red', 'Red', 'Red', 'Red'], 'Yellow')).toBe(-(100 * 1.5));
        expect(evaluateWindow(['Yellow', 'Yellow', 'Yellow', 'Yellow'], 'Red')).toBe(-(100 * 1.5));
    });

    it('returns 0 for contested windows', () => {
        expect(evaluateWindow(['Red', 'Yellow', 'Red', 'Empty'], 'Red')).toBe(0);
        expect(evaluateWindow(['Empty', 'Yellow', 'Red', 'Empty'], 'Yellow')).toBe(0);
    });
});

describe('evaluateBoard', () => {
    const makeEmptyBoard = (): CellValue[][] =>
        Array.from({ length: 6 }, () => Array(7).fill('Empty') as CellValue[]);

    it('returns 0 for an empty board', () => {
        const board = makeEmptyBoard();
        expect(evaluateBoard(board, 'Red')).toBe(0);
        expect(evaluateBoard(board, 'Yellow')).toBe(0);
    });

    it('applies center column bonus for AI discs', () => {
        const board = makeEmptyBoard();
        const center = Math.floor(7 / 2);
        board[2][center] = 'Red';
        board[5][center] = 'Red';
        expect(evaluateBoard(board, 'Red')).toBe(8);
    });

    it('applies center column penalty for opponent discs', () => {
        const board = makeEmptyBoard();
        const center = Math.floor(7 / 2);
        board[4][center] = 'Yellow';
        expect(evaluateBoard(board, 'Red')).toBe(-3);
    });

    it('applies horizontal window scores', () => {
        const board = makeEmptyBoard();
        board[3][0] = 'Yellow';
        board[3][1] = 'Yellow';
        expect(evaluateBoard(board, 'Yellow')).toBe(2);
    });

    it('applies vertical window scores', () => {
        const board = makeEmptyBoard();
        board[1][4] = 'Red';
        board[2][4] = 'Red';
        const expected = 1.6 + 2;
        expect(evaluateBoard(board, 'Red')).toBeCloseTo(expected);
    });

    it('applies top row penalty for horizontal windows on row 0', () => {
        const board = makeEmptyBoard();
        board[0][0] = 'Red';
        board[0][1] = 'Red';
        const penalized = 2 * 0.8;
        expect(evaluateBoard(board, 'Red')).toBeCloseTo(penalized);
    });

    it('applies top row penalty for vertical windows on row 0', () => {
        const board = makeEmptyBoard();
        board[0][2] = 'Yellow';
        board[1][2] = 'Yellow';
        const penalized = 2 * 0.8;
        expect(evaluateBoard(board, 'Yellow')).toBeCloseTo(penalized);
    });

    it('applies down-right diagonal window scores', () => {
        const board = makeEmptyBoard();
        board[2][0] = 'Red';
        board[3][1] = 'Red';
        expect(evaluateBoard(board, 'Red')).toBe(2);
    });

    it('applies down-left diagonal window scores with center bonus', () => {
        const board = makeEmptyBoard();
        board[0][3] = 'Yellow';
        board[1][2] = 'Yellow';
        // Diagonal base (2 * 0.8 = 1.6) + center column bonus (3) = 4.6
        expect(evaluateBoard(board, 'Yellow')).toBeCloseTo(4.6);
    });

    it('combined multiple four-in-a-rows with opponent threats yields penalty', () => {
        const board = makeEmptyBoard();
        // horizontal four for Red
        for (let c = 0; c < 4; c++) board[4][c] = 'Red';
        // vertical four for Yellow
        for (let r = 2; r < 6; r++) board[r][5] = 'Yellow';
        // diagonal down-right four for Red
        board[1][1] = 'Red';
        board[2][2] = 'Red';
        board[3][3] = 'Red';
        board[4][4] = 'Red';
        // both players have opponent open-three threats
        expect(evaluateBoard(board, 'Red')).toBe(-1e6);
        expect(evaluateBoard(board, 'Yellow')).toBe(-1e6);
    });

    it('penalizes opponent open-three diagonally', () => {
        const board = makeEmptyBoard();
        board[0][0] = 'Yellow';
        board[1][1] = 'Yellow';
        board[2][2] = 'Yellow';
        expect(evaluateBoard(board, 'Red')).toBe(-1e6);
    });

    it('prioritizes open-three penalty over four-in-a-row scoring', () => {
        const board = makeEmptyBoard();
        board[0][0] = 'Red';
        board[0][1] = 'Red';
        board[0][2] = 'Red';
        for (let c = 0; c < 4; c++) board[5][c] = 'Yellow';
        expect(evaluateBoard(board, 'Yellow')).toBe(-1e6);
    });
});
