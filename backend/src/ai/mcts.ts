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

export function cloneBoard(board: CellValue[][]): CellValue[][] {
  return board.map(row => [...row]);
}

/** Softmax distribution */
export function softmax(scores: number[], temperature = 1): number[] {
  const exps = scores.map(s => Math.exp(s / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

/** Sample according to weights */
export function chooseWeighted(moves: number[], weights: number[]): number {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < moves.length; i++) {
    cum += weights[i];
    if (r < cum) return moves[i];
  }
  return moves[moves.length - 1];
}

/** Playout where each side uses its own eval to simulate realistic play */
export function playout(
  startBoard: CellValue[][],
  startingPlayer: CellValue,
  aiDisc: CellValue
): CellValue {
  let board = cloneBoard(startBoard);
  let current = startingPlayer;

  while (true) {
    const moves = legalMoves(board);
    if (moves.length === 0) return "Empty";

    // Evaluate moves for current player
    const scores = moves.map(col => {
      const { board: nb } = tryDrop(board, col, current);
      return evaluateBoard(nb, current);
    });

    const probs = softmax(scores);
    const col = chooseWeighted(moves, probs);
    const { board: nextBoard } = tryDrop(board, col, current);

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
      const uctChild =
        child.wins / (child.visits + 1e-9) +
        Math.sqrt(2 * Math.log(current.visits + 1) / (child.visits + 1e-9));
      const uctBest =
        best.wins / (best.visits + 1e-9) +
        Math.sqrt(2 * Math.log(current.visits + 1) / (best.visits + 1e-9));
      return uctChild > uctBest ? child : best;
    });
  }
  return current;
}

export function expand(node: MCTSNode): void {
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

export function backpropagate(
  node: MCTSNode,
  winner: CellValue,
  aiDisc: CellValue
): void {
  let cur: MCTSNode | null = node;
  while (cur) {
    cur.visits++;
    if (winner === aiDisc) cur.wins++;
    cur = cur.parent;
  }
}

/**
 * MCTS with node-cap to prevent over-allocation and proper playout.
 */
export function mcts(
  board: CellValue[][],
  aiDisc: CellValue,
  timeMs: number
): number {
  const moves = legalMoves(board);

  // 1) Root heuristics: immediate win/block
  for (const col of moves) {
    const { board: nb } = tryDrop(board, col, aiDisc);
    const { red: rBB, yellow: yBB } = boardToBitboards(nb);
    const bb = aiDisc === "Red" ? rBB : yBB;
    if (bitboardCheckWin(bb)) return col;
  }
  const opp = aiDisc === "Red" ? "Yellow" : "Red";
  for (const col of moves) {
    const { board: nb } = tryDrop(board, col, opp);
    const { red: rBB, yellow: yBB } = boardToBitboards(nb);
    const bb = opp === "Red" ? rBB : yBB;
    if (bitboardCheckWin(bb)) return col;
  }

  // 2) MCTS setup
  const root: MCTSNode = {
    board: cloneBoard(board),
    player: opp,
    visits: 0,
    wins: 0,
    parent: null,
    children: [],
    move: null,
  };

  const MAX_NODES = 10000;
  let nodeCount = 1;
  const endTime = Date.now() + Math.max(timeMs, 500);

  // 3) Search loop
  while (Date.now() < endTime) {
    // Selection
    let node = select(root);

    // Expansion (only if budget allows)
    if (node.visits > 0 && node.children.length === 0 && nodeCount < MAX_NODES) {
      expand(node);
      nodeCount += node.children.length;
    }

    // Pick leaf
    const leaf =
      node.children.length > 0
        ? node.children[Math.floor(Math.random() * node.children.length)]
        : node;

    // Simulation
    const winner = playout(leaf.board, leaf.player, aiDisc);

    // Backpropagation
    backpropagate(leaf, winner, aiDisc);
  }

  // 4) Choose best
  let bestCol = moves[0];
  let bestVisits = -1;
  for (const child of root.children) {
    if (child.visits > bestVisits && child.move !== null) {
      bestVisits = child.visits;
      bestCol = child.move;
    }
  }
  return bestCol;
}
