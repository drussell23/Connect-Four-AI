// src/ai/mcts.ts
import { CellValue } from "./types";
import { legalMoves, tryDrop } from "./utils";
import { boardToBitboards, bitboardCheckWin } from "./bitboard";
import { evaluateBoard } from "./evaluate";

interface MCTSNode {
    board: CellValue[][];
    player: CellValue;
    visits: number;
    wins: number;
    parent: MCTSNode | null;
    children: MCTSNode[];
    move: number | null;
}

function cloneBoard(board: CellValue[][]): CellValue[][] {
    return board.map(row => [...row]);
}

/**
 * Turn an array of scores into a probability distribution
 * via softmax (temperature = 1.0 by default).
 */
function softmax(scores: number[], temperature = 1): number[] {
    const exps = scores.map(s => Math.exp(s / temperature));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sum);
}

/**
 * Randomly sample one of `moves` according to `weights` (which sum to 1).
 */
function chooseWeighted(moves: number[], weights: number[]): number {
    const r = Math.random();
    let cum = 0;
    for (let i = 0; i < moves.length; i++) {
        cum += weights[i];
        if (r < cum) return moves[i];
    }
    return moves[moves.length - 1];
}

/**
 * Biased playout: at each step, score each legal move
 * by evaluating the resulting board for the *AI* (not the current player),
 * softmax those scores, then sample.
 */
function playout(
    startBoard: CellValue[][],
    startingPlayer: CellValue,
    aiDisc: CellValue
): CellValue {
    let board = cloneBoard(startBoard);
    let current = startingPlayer;

    while (true) {
        const moves = legalMoves(board);
        if (moves.length === 0) return "Empty";

        // 1) Score each successor
        const scores = moves.map(col => {
            const { board: nb } = tryDrop(board, col, current);
            return evaluateBoard(nb, aiDisc);
        });

        // 2) Turn into probabilities and sample
        const probs = softmax(scores);
        const col = chooseWeighted(moves, probs);

        // 3) Play it out
        const { board: nextBoard } = tryDrop(board, col, current);

        // 4) Early win-check via bitboards
        const { red: rBB, yellow: yBB } = boardToBitboards(nextBoard);
        const bb = current === "Red" ? rBB : yBB;
        if (bitboardCheckWin(bb)) return current;

        board = nextBoard;
        current = current === "Red" ? "Yellow" : "Red";
    }
}

function select(node: MCTSNode): MCTSNode {
    let current = node;
    while (current.children.length > 0) {
        current = current.children.reduce((best, child) => {
            const uctA =
                child.wins / (child.visits + 1e-9) +
                Math.sqrt(2 * Math.log(current.visits + 1) / (child.visits + 1e-9));
            const uctB =
                best.wins / (best.visits + 1e-9) +
                Math.sqrt(2 * Math.log(current.visits + 1) / (best.visits + 1e-9));
            return uctA > uctB ? child : best;
        });
    }
    return current;
}

function expand(node: MCTSNode): void {
    const moves = legalMoves(node.board);
    const nextPlayer = node.player === "Red" ? "Yellow" : "Red";
    for (const col of moves) {
        const { board: nb } = tryDrop(node.board, col, nextPlayer);
        node.children.push({
            board: nb,
            player: nextPlayer,
            visits: 0,
            wins: 0,
            parent: node,
            children: [],
            move: col,
        });
    }
}

function backpropagate(node: MCTSNode, winner: CellValue, aiDisc: CellValue): void {
    let cur: MCTSNode | null = node;
    while (cur) {
        cur.visits++;
        if (winner === aiDisc) cur.wins++;
        cur = cur.parent;
    }
}

/**
 * Hybrid MCTS that now uses a biased simulation policy.
 */
export function mcts(
    board: CellValue[][],
    aiDisc: CellValue,
    timeMs: number
): number {
    const root: MCTSNode = {
        board: cloneBoard(board),
        player: aiDisc === "Red" ? "Yellow" : "Red",
        visits: 0,
        wins: 0,
        parent: null,
        children: [],
        move: null,
    };
    const endTime = Date.now() + timeMs;

    while (Date.now() < endTime) {
        // 1. Selection
        let node = select(root);

        // 2. Expansion
        if (node.visits > 0 && node.children.length === 0) expand(node);

        // 3. Simulation (now biased)
        const leaf = node.children.length > 0 ? node.children[0] : node;
        const winner = playout(leaf.board, leaf.player === aiDisc ? aiDisc : leaf.player, aiDisc);

        // 4. Backpropagation
        backpropagate(leaf, winner, aiDisc);
    }

    // Choose the move with the most visits
    return root.children.reduce((a, b) => (a.visits > b.visits ? a : b)).move!;
}
