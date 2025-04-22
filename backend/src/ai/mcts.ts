import { CellValue } from './types';
import { legalMoves, tryDrop, checkWin } from './utils';

/**
 * Monte Carlo Tree Search node.
 */
interface MCTSNode {
  board: CellValue[][];
  player: CellValue;              // who moved to reach this node
  visits: number;                 // number of times node was visited
  wins: number;                   // number of wins for AI from this node
  parent: MCTSNode | null;
  children: MCTSNode[];
  move: number | null;            // the move (column) that led to this node
}

/**
 * Deep-clones a board.
 */
function cloneBoard(board: CellValue[][]): CellValue[][] {
  return board.map(row => [...row]);
}

/**
 * Simulates a random playout from the given board, returning the winning disc or 'Empty' for draw.
 */
function playout(startBoard: CellValue[][], startingPlayer: CellValue): CellValue {
  let board = cloneBoard(startBoard);
  let current = startingPlayer;
  while (true) {
    const moves = legalMoves(board);
    if (moves.length === 0) return 'Empty';
    const col = moves[Math.floor(Math.random() * moves.length)];
    const { board: nextBoard, row } = tryDrop(board, col, current);
    if (checkWin(nextBoard, row, col, current)) {
      return current;
    }
    board = nextBoard;
    current = current === 'Red' ? 'Yellow' : 'Red';
  }
}

/**
 * Selects a leaf node to expand using UCT.
 */
function select(node: MCTSNode): MCTSNode {
  let current = node;
  while (current.children.length > 0) {
    current = current.children.reduce((best, child) => {
      const uctValue =
        (child.wins / (child.visits + 1e-9)) +
        Math.sqrt(2 * Math.log(current.visits + 1) / (child.visits + 1e-9));
      const bestUct =
        (best.wins / (best.visits + 1e-9)) +
        Math.sqrt(2 * Math.log(current.visits + 1) / (best.visits + 1e-9));
      return uctValue > bestUct ? child : best;
    });
  }
  return current;
}

/**
 * Expands a leaf node by generating all possible child nodes.
 */
function expand(node: MCTSNode): void {
  const moves = legalMoves(node.board);
  const nextPlayer = node.player === 'Red' ? 'Yellow' : 'Red';
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

/**
 * Backpropagates the simulation result up the tree.
 */
function backpropagate(node: MCTSNode, winner: CellValue, aiDisc: CellValue): void {
  let current: MCTSNode | null = node;
  while (current) {
    current.visits++;
    if (winner === aiDisc) {
      current.wins++;
    }
    current = current.parent;
  }
}

/**
 * Runs MCTS for a given time budget and returns the best move (column index).
 */
export function mcts(
  board: CellValue[][],
  aiDisc: CellValue,
  timeMs: number
): number {
  const root: MCTSNode = {
    board: cloneBoard(board),
    player: aiDisc === 'Red' ? 'Yellow' : 'Red', // last move was opponent if starting at root
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
    if (node.visits > 0 && node.children.length === 0) {
      expand(node);
    }
    // 3. Simulation
    const leaf = node.children.length > 0 ? node.children[0] : node;
    const winner = playout(leaf.board, leaf.player === aiDisc ? aiDisc : leaf.player);
    // 4. Backpropagation
    backpropagate(leaf, winner, aiDisc);
  }

  // Pick the child with highest visit count
  const bestChild = root.children.reduce((a, b) =>
    a.visits > b.visits ? a : b
  );
  return bestChild.move!;
}
