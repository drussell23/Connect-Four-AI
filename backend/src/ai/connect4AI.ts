// src/ai/connect4AI.ts

/** Valid values for each cell in the Connect 4 grid **/
export type CellValue = 'Empty' | 'Red' | 'Yellow';

/** Rich move info for ordering and pruning. **/
export interface Move {
  col: number;
  row: number;
  isWinning: boolean;
  isBlocking: boolean;
  priority: number;
}

/**
 * Compute the row index where a disc would land if dropped in the given column.
 * Returns null if the column is already full.
 */
export function getDropRow(board: CellValue[][], col: number): number | null {
  for (let r = board.length - 1; r >= 0; r--) {
    if (board[r][col] === 'Empty') {
      return r;
    }
  }
  return null;
}

/**
 * Returns moves sorted by priority:
 * 1000 = immediate win, 900 = immediate block, 800–0 = center bias.
 */
export function orderedMoves(
  board: CellValue[][],
  currentPlayer: CellValue
): Move[] {
  const COLS = board[0].length;
  const center = Math.floor(COLS / 2);
  const opponent: CellValue = currentPlayer === 'Red' ? 'Yellow' : 'Red';

  // 1) collect all non‐full columns + rows
  const candidates: { col: number; row: number }[] = [];
  for (let col = 0; col < COLS; col++) {
    const row = getDropRow(board, col);
    if (row !== null) candidates.push({ col, row });
  }

  // 2) detect opponent win‐in‐one
  const threat = new Set<number>();
  for (const { col, row } of candidates) {
    const sim = board.map(r => [...r] as CellValue[]);
    sim[row][col] = opponent;
    if (bitboardCheckWin(getBits(sim, opponent))) threat.add(col);
  }

  // 3) annotate with win/block/center‐bias
  const moves: Move[] = candidates.map(({ col, row }) => {
    // win?
    const winBoard = board.map(r => [...r] as CellValue[]);
    winBoard[row][col] = currentPlayer;
    const isWinning = bitboardCheckWin(getBits(winBoard, currentPlayer));

    // block?
    const isBlocking = threat.has(col);

    // priority
    let priority = 800 - Math.abs(col - center);
    if (isBlocking) priority = 900;
    if (isWinning) priority = 1000;

    return { col, row, isWinning, isBlocking, priority };
  });

  // 4) highest first
  return moves.sort((a, b) => b.priority - a.priority);
}

/** Returns an array of column indices (0–6) that are not full. **/
export function legalMoves(board: CellValue[][]): number[] {
  const cols = board[0].length;
  return Array.from({ length: cols }, (_, c) => c).filter(
    (c) => board[0][c] === 'Empty'
  );
}

/** Drops a disc in the given column, returning the new board and the row index. **/
export function tryDrop(
  board: CellValue[][],
  column: number,
  disc: CellValue
): { board: CellValue[][]; row: number } {
  const newBoard = board.map((row) => [...row]);
  for (let r = newBoard.length - 1; r >= 0; r--) {
    if (newBoard[r][column] === 'Empty') {
      newBoard[r][column] = disc;
      return { board: newBoard, row: r };
    }
  }
  throw new Error(`Column ${column} is full`);
}

/** Bitboard utilities **/
export function boardToBitboards(board: CellValue[][]): { red: bigint; yellow: bigint } {
  let red = 0n;
  let yellow = 0n;
  const COLS = BigInt(board[0].length);
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      const idx = BigInt(r) * COLS + BigInt(c);
      if (board[r][c] === 'Red') red |= 1n << idx;
      else if (board[r][c] === 'Yellow') yellow |= 1n << idx;
    }
  }
  return { red, yellow };
}

/** Helper to pick the correct bitboard for a disc **/
export function getBits(board: CellValue[][], disc: CellValue): bigint {
  const { red, yellow } = boardToBitboards(board);
  return disc === 'Red' ? red : yellow;
}

export function bitboardCheckWin(bb: bigint): boolean {
  // horizontal
  let m = bb & (bb >> 1n);
  if ((m & (m >> 2n)) !== 0n) return true;
  // vertical
  m = bb & (bb >> 7n);
  if ((m & (m >> (14n))) !== 0n) return true;
  // diag down-right
  m = bb & (bb >> 8n);
  if ((m & (m >> (16n))) !== 0n) return true;
  // diag down-left
  m = bb & (bb >> 6n);
  if ((m & (m >> (12n))) !== 0n) return true;
  return false;
}

/** Static board evaluation **/
const WINDOW = 4;
const BASE_SCORES: Record<number, number> = { 4: 100, 3: 5, 2: 2 };
const OPEN_THREE_BONUS = { bothEnds: 4, oneEnd: 2 };
const CENTER_COLUMN_BONUS = 3;
const TOP_ROW_PENALTY_FACTOR = 0.8;

/** Static board evaluation for one 4-cell window, with logging & safety. **/
export function evaluateWindow(
  cells: CellValue[],
  aiDisc: CellValue
): number {
  try {
    const humanDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
    const aiCount = cells.filter(c => c === aiDisc).length;
    const humanCount = cells.filter(c => c === humanDisc).length;
    const emptyCount = cells.filter(c => c === 'Empty').length;

    console.debug(`[evaluateWindow] cells=${JSON.stringify(cells)} aiCount=${aiCount} humanCount=${humanCount} emptyCount=${emptyCount}`);

    // 1) Immediate four-in-a-row
    if (aiCount === 4) {
      console.info(`[evaluateWindow] found AI connect-4! Window=${cells}`);
      return 1e6;
    }
    if (humanCount === 4) {
      console.info(`[evaluateWindow] found human connect-4! Window=${cells}`);
      return -1e6;
    }

    let score = 0;

    // 2) Open-three pattern (3 + 1 empty)
    if (aiCount === 3 && emptyCount === 1) {
      const ends = (cells[0] === 'Empty' ? 1 : 0) + (cells[3] === 'Empty' ? 1 : 0);
      const bonus = ends === 2 ? OPEN_THREE_BONUS.bothEnds * 20 : OPEN_THREE_BONUS.oneEnd * 10;
      console.debug(`[evaluateWindow] AI open-three (${ends === 2 ? 'bothEnds' : 'oneEnd'}) => +${bonus}`);
      score += BASE_SCORES[3] + bonus;
    }

    if (humanCount === 3 && emptyCount === 1) {
      const ends = (cells[0] === 'Empty' ? 1 : 0) + (cells[3] === 'Empty' ? 1 : 0);
      const penalty = ends === 2 ? OPEN_THREE_BONUS.bothEnds * 25 : OPEN_THREE_BONUS.oneEnd * 15;
      console.debug(`[evaluateWindow] Human open-three (${ends === 2 ? 'bothEnds' : 'oneEnd'}) => -${penalty}`);
      score -= BASE_SCORES[3] * 1.5 + penalty;
    }

    // 3) Two-in-a-row with two empties: building threats
    if (aiCount === 2 && emptyCount === 2) {
      const add = BASE_SCORES[2] * 1.2;
      console.debug(`[evaluateWindow] AI two-in-a-row => +${add}`);
      score += add;
    }

    if (humanCount === 2 && emptyCount === 2) {
      const sub = BASE_SCORES[2] * 1.8;
      console.debug(`[evaluateWindow] Human two-in-a-row => -${sub}`);
      score -= sub;
    }

    // 4) Center‐cell bonus/penalty within this window
    const centerIdx = Math.floor(cells.length / 2);
    if (cells[centerIdx] === aiDisc) {
      console.debug(`[evaluateWindow] center bonus +${CENTER_COLUMN_BONUS}`);
      score += CENTER_COLUMN_BONUS;
    }
    if (cells[centerIdx] === humanDisc) {
      console.debug(`[evaluateWindow] center penalty -${CENTER_COLUMN_BONUS}`);
      score -= CENTER_COLUMN_BONUS;
    }

    console.debug(`[evaluateWindow] final score=${score} for window=${JSON.stringify(cells)}`);
    return score;

  } catch (err) {
    console.error('[evaluateWindow] error evaluating window', cells, err);
    // fail safe: no bias
    return 0;
  }
}

export function evaluateBoard(
  board: CellValue[][],
  aiDisc: CellValue
): number {
  const rows = board.length;
  const cols = board[0].length;
  const humanDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';
  let score = 0;

  // Immediate open-three penalty.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - WINDOW; c++) {
      const w = board[r].slice(c, c + WINDOW);
      if (
        w.filter((x) => x === humanDisc).length === 3 &&
        w.filter((x) => x === 'Empty').length === 1
      ) {
        return -1e6;
      }
    }
  }

  // Horizontal, Vertical, Diagonal.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - WINDOW; c++) {
      score += evaluateWindow(board[r].slice(c, c + WINDOW), aiDisc) *
        (r === 0 ? TOP_ROW_PENALTY_FACTOR : 1);
    }
  }

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r <= rows - WINDOW; r++) {
      const w = [0, 1, 2, 3].map((i) => board[r + i][c]);
      score += evaluateWindow(w, aiDisc) * (r === 0 ? TOP_ROW_PENALTY_FACTOR : 1);
    }
  }

  for (let r = 0; r <= rows - WINDOW; r++) {
    for (let c = 0; c <= cols - WINDOW; c++) {
      const dr = [0, 1, 2, 3].map((i) => board[r + i][c + i]);
      score += evaluateWindow(dr, aiDisc) * (r === 0 ? TOP_ROW_PENALTY_FACTOR : 1);
      const dl = [0, 1, 2, 3].map(
        (i) => board[r + i][c + WINDOW - 1 - i]
      );
      score += evaluateWindow(dl, aiDisc) * (r === 0 ? TOP_ROW_PENALTY_FACTOR : 1);
    }
  }

  const center = Math.floor(cols / 2);

  for (let r = 0; r < rows; r++) {
    score += board[r][center] === aiDisc
      ? CENTER_COLUMN_BONUS
      : board[r][center] === humanDisc
        ? -CENTER_COLUMN_BONUS
        : 0;
  }
  return score;
}

/** Transposition table with Zobrist hashing **/
export enum EntryFlag { Exact, LowerBound, UpperBound }
export interface TranspositionEntry {
  score: number;
  depth: number;
  column: number | null;
  flag: EntryFlag;
}

const MAX_ENTRIES = 1_000_000;
const transposition = new Map<bigint, TranspositionEntry>();

export function rand64(): bigint {
  const buf = require('crypto').randomBytes(8);
  let n = 0n;
  buf.forEach((b: number) => {
    n = (n << 8n) | BigInt(b);
  });
  return n;
}

const ZOBRIST_TABLE: bigint[][][] = Array.from({ length: 6 }, () =>
  Array.from({ length: 7 }, () => [rand64(), rand64(), rand64()]));

export function hashBoard(board: CellValue[][]): bigint {
  let h = 0n;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const idx = board[r][c] === 'Red' ? 1 : board[r][c] === 'Yellow' ? 2 : 0;
      h ^= ZOBRIST_TABLE[r][c][idx];
    }
  }
  return h;
}

export function clearTable(): void {
  transposition.clear();
}

export function getEntry(
  hash: bigint
): TranspositionEntry | undefined {
  return transposition.get(hash);
}

export function storeEntry(
  hash: bigint,
  entry: TranspositionEntry
): void {
  const existing = transposition.get(hash);
  if (
    !existing ||
    entry.depth > existing.depth ||
    entry.flag === EntryFlag.Exact
  ) {
    if (transposition.size > MAX_ENTRIES) {
      let toEvict = Math.floor(MAX_ENTRIES * 0.1);

      for (const key of transposition.keys()) {
        transposition.delete(key);
        toEvict--;
        if (toEvict <= 0)
          break;
      }
    }
    transposition.set(hash, entry);
  }
}

/** Minimax with α–β, null-move pruning, history, transposition, and advanced logging **/
interface Node { score: number; column: number | null; }
const NULL_MOVE_REDUCTION = 2;
const historyTable: number[][] = Array.from({ length: 7 }, () => []);

export function minimax(
  board: CellValue[][],
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  aiDisc: CellValue
): Node {
  try {
    // 1) Transposition lookup
    const key = hashBoard(board);
    clearTable();
    const entry = getEntry(key);
    if (entry && entry.depth >= depth) {
      console.debug(`[minimax] Transposition hit at depth=${depth}, score=${entry.score}`);
      if (entry.flag === EntryFlag.Exact) return { score: entry.score, column: entry.column };
      if (entry.flag === EntryFlag.LowerBound) alpha = Math.max(alpha, entry.score);
      if (entry.flag === EntryFlag.UpperBound) beta = Math.min(beta, entry.score);
      if (alpha >= beta) return { score: entry.score, column: entry.column };
    }

    // 2) Generate ordered moves
    const richMoves = orderedMoves(board, aiDisc);
    if (richMoves.length === 0) {
      console.debug(`[minimax] Terminal node (no moves) at depth=${depth}`);
      return { column: null, score: maximizingPlayer ? -Infinity : Infinity };
    }

    // 3) Whose turn?
    const current = maximizingPlayer ? aiDisc : (aiDisc === 'Red' ? 'Yellow' : 'Red');
    const otherPlayer = maximizingPlayer ? (aiDisc === 'Red' ? 'Yellow' : 'Red') : aiDisc;

    // 4) Immediate win/block short-circuits
    for (const move of richMoves) {
      const { col, isWinning, isBlocking } = move;
      if (isWinning) {
        console.info(`[minimax] Immediate win at col=${col} depth=${depth}`);
        return { column: col, score: maximizingPlayer ? Infinity : -Infinity };
      }
      if (isBlocking) {
        console.info(`[minimax] Immediate block at col=${col} depth=${depth}`);
        return { column: col, score: maximizingPlayer ? -Infinity : Infinity };
      }
    }

    // 5) Null-move pruning
    if (maximizingPlayer && depth > NULL_MOVE_REDUCTION + 1) {
      const { col: skipCol } = richMoves[0];
      console.debug(`[minimax] Null-move attempt skipping col=${skipCol} at depth=${depth}`);
      const { board: nb } = tryDrop(board, skipCol, current);
      const nullNode = minimax(
        nb,
        depth - 1 - NULL_MOVE_REDUCTION,
        -beta,
        -beta + 1,
        !maximizingPlayer,
        aiDisc
      );
      if (-nullNode.score >= beta) {
        console.info(`[minimax] Null-move cutoff at depth=${depth} with skipCol=${skipCol}`);
        return { column: null, score: beta };
      }
    }

    // 6) Main α–β loop
    let best: Node = { column: null, score: maximizingPlayer ? -Infinity : Infinity };
    const alphaOrig = alpha, betaOrig = beta;

    for (const move of richMoves) {
      const { col, isWinning, isBlocking, priority } = move;
      console.debug(
        `[minimax] Considering col=${col} (win=${isWinning}, block=${isBlocking}, prio=${priority}) ` +
        `at depth=${depth}`
      );

      // Recurse
      const { board: next } = tryDrop(board, col, current);
      const child = minimax(
        next,
        depth - 1,
        -beta,
        -alpha,
        !maximizingPlayer,
        aiDisc
      );
      const sc = -child.score;

      // Beefed-up future threat logging for shallow depths
      if (depth <= 3) {
        const oppThreats = orderedMoves(next, otherPlayer)
          .slice(0, 2)
          .map(t =>
            `col=${t.col}` +
            (t.isWinning ? ` (win)` : t.isBlocking ? ` (block)` : ``) +
            ` [prio=${t.priority}]`
          );
        console.info(
          `[minimax] After our move col=${col}, opp top threats: ` +
          oppThreats.join('  |  ')
        );
      }

      // Update best & α/β
      if ((maximizingPlayer && sc > best.score) || (!maximizingPlayer && sc < best.score)) {
        console.debug(`[minimax] New best at col=${col} score=${sc} (was ${best.score})`);
        best = { column: col, score: sc };
      }
      alpha = maximizingPlayer ? Math.max(alpha, sc) : alpha;
      beta = !maximizingPlayer ? Math.min(beta, sc) : beta;

      // History heuristic
      historyTable[col][depth] = (historyTable[col][depth] || 0) + priority;

      // Cutoff
      if (alpha >= beta) {
        console.info(
          `[minimax] Alpha-beta cutoff at col=${col}, depth=${depth}, ` +
          `alpha=${alpha}, beta=${beta}`
        );
        break;
      }
    }

    // 7) Transposition store
    let flag = EntryFlag.Exact;
    if (best.score <= alphaOrig) flag = EntryFlag.UpperBound;
    else if (best.score >= betaOrig) flag = EntryFlag.LowerBound;
    storeEntry(key, { score: best.score, depth, column: best.column, flag });

    return best;
  } catch (err) {
    console.error('[minimax] Unexpected error:', err);
    return { column: null, score: maximizingPlayer ? -Infinity : Infinity };
  }
}

/** Monte Carlo Tree Search **/
export interface MCTSNode {
  board: CellValue[][];
  player: CellValue;
  visits: number;
  wins: number;
  parent: MCTSNode | null;
  children: MCTSNode[];
  move: number | null;
}

export function cloneBoard(board: CellValue[][]): CellValue[][] {
  return board.map((r) => [...r]);
}

export function softmax(scores: number[], temperature = 1): number[] {
  const exps = scores.map((s) => Math.exp(s / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export function chooseWeighted(
  moves: number[],
  weights: number[]
): number {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < moves.length; i++) {
    cum += weights[i];
    if (r < cum) return moves[i];
  }
  return moves[moves.length - 1];
}

export function playout(
  startBoard: CellValue[][],
  startingPlayer: CellValue,
  _aiDisc: CellValue
): CellValue {
  let board = cloneBoard(startBoard);
  let current = startingPlayer;
  while (true) {
    const moves = legalMoves(board);
    if (!moves.length) return 'Empty';
    const scores = moves.map((c) => {
      const nextBoard = tryDrop(board, c, current).board;
      return evaluateBoard(nextBoard, current);
    });
    const col = chooseWeighted(moves, softmax(scores));
    const nextRes = tryDrop(board, col, current);
    board = nextRes.board;
    if (bitboardCheckWin(getBits(board, current))) return current;
    current = current === 'Red' ? 'Yellow' : 'Red';
  }
}

export function select(node: MCTSNode): MCTSNode {
  let cur = node;
  while (cur.children.length) {
    cur = cur.children.reduce((best, child) => {
      const uct =
        child.wins / (child.visits + 1e-9) +
        Math.sqrt(2 * Math.log(cur.visits + 1) / (child.visits + 1e-9));
      const ubest =
        best.wins / (best.visits + 1e-9) +
        Math.sqrt(2 * Math.log(cur.visits + 1) / (best.visits + 1e-9));
      return uct > ubest ? child : best;
    });
  }
  return cur;
}

export function expand(node: MCTSNode): void {
  const moves = legalMoves(node.board);
  const next = node.player === 'Red' ? 'Yellow' : 'Red';
  moves.forEach((col) => {
    const res = tryDrop(node.board, col, next);
    node.children.push({
      board: res.board,
      player: next,
      visits: 0,
      wins: 0,
      parent: node,
      children: [],
      move: col,
    });
  });
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

export function mcts(
  board: CellValue[][],
  aiDisc: CellValue,
  timeMs: number
): number {
  // Pick candidate columns by priortiy.
  const cols = orderedMoves(board, aiDisc).map(m => m.col);

  // Immediate win.
  for (const col of cols) {
    const res = tryDrop(board, col, aiDisc);
    if (bitboardCheckWin(getBits(res.board, aiDisc))) return col;
  }

  // Immediate block.
  const opp = aiDisc === 'Red' ? 'Yellow' : 'Red';
  for (const col of cols) {
    const res = tryDrop(board, col, opp);
    if (bitboardCheckWin(getBits(res.board, opp))) return col;
  }

  // Set up the root node. 
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

  // Rollout loop.
  while (Date.now() < endTime) {
    let node = select(root);
    if (node.visits > 0 && node.children.length === 0 && nodeCount < MAX_NODES) {
      expand(node);
      nodeCount += node.children.length;
    }
    const leaf =
      node.children.length > 0
        ? node.children[Math.floor(Math.random() * node.children.length)]
        : node;
    const winner = playout(leaf.board, leaf.player, aiDisc);
    backpropagate(leaf, winner, aiDisc);
  }

  let bestMove = cols[0];
  let bestVisits = -1;

  for (const child of root.children) {
    if (child.visits > bestVisits && child.move !== null) {
      bestVisits = child.visits;
      bestMove = child.move;
    }
  }
  return bestMove;
}

// Search settings
const ENGINE_MAX_DEPTH = 12;
const THREAT_THRESHOLD = 1;

/**
 * Detect all single‐move forks (3 in a row + 1 gap) for the opponent,
 * score them by direction and center‐distance, then block the highest‐scoring one.
 *
 * @param board 6×7 grid of CellValue
 * @param opp   Opponent’s disc ('Red' or 'Yellow')
 * @returns Column index to block, or null if no fork found
 */
export function findOpenThreeBlock(
  board: CellValue[][],
  opp: CellValue
): number | null {
  try {
    const ROWS = board.length;
    const COLS = board[0].length;
    const WINDOW = 4;
    const center = Math.floor(COLS / 2);

    // Directional weights: adjust these to prioritize certain threat angles
    const DIR_WEIGHTS: Record<string, number> = {
      horiz: 5,
      vert: 3,
      diagDR: 4,  // down-right
      diagDL: 4   // down-left
    };

    // Map a (dr,dc) pair to one of our direction keys.
    const dirKey = (dr: number, dc: number): string => {
      if (dr === 0 && dc === 1) return 'horiz';
      if (dr === 1 && dc === 0) return 'vert';
      if (dr === 1 && dc === 1) return 'diagDR';
      if (dr === 1 && dc === -1) return 'diagDL';
      return 'horiz';
    };

    // We'll track the best priority for each column
    const threatScores = new Map<number, number>();

    const dirs = [
      { dr: 0, dc: 1 },
      { dr: 1, dc: 0 },
      { dr: 1, dc: 1 },
      { dr: 1, dc: -1 },
    ];

    for (const { dr, dc } of dirs) {
      const key = dirKey(dr, dc);
      const angleWeight = DIR_WEIGHTS[key] || 1;

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          // Gather up to WINDOW cells in this direction.
          const cells: CellValue[] = [];
          const coords: [number, number][] = [];
          for (let i = 0; i < WINDOW; i++) {
            const rr = r + dr * i;
            const cc = c + dc * i;
            if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break;
            cells.push(board[rr][cc]);
            coords.push([rr, cc]);
          }
          if (cells.length < WINDOW) continue;

          const oppCnt = cells.filter(x => x === opp).length;
          const empCnt = cells.filter(x => x === 'Empty').length;
          if (oppCnt === 3 && empCnt === 1) {
            const gapIdx = cells.findIndex(x => x === 'Empty');
            const [gapRow, gapCol] = coords[gapIdx];

            // Gravity check: disc must be able to land here.
            if (gapRow === ROWS - 1 || board[gapRow + 1][gapCol] !== 'Empty') {

              // Compute a combined priority: angleWeight * 100  minus distance from center.
              const dist = Math.abs(gapCol - center);
              const priority = angleWeight * 100 - dist;

              console.info(
                `[findOpenThreeBlock] fork at dir=${key} ` +
                `window origin=(${r},${c}), gap=[${gapRow},${gapCol}] ` +
                `=> score=${priority}`
              );

              // Keep the highest score per column.
              const prev = threatScores.get(gapCol) ?? -Infinity;
              threatScores.set(gapCol, Math.max(prev, priority));
            }
          }
        }
      }
    }

    if (threatScores.size === 0) {
      console.debug('[findOpenThreeBlock] no forks found');
      return null;
    }

    // Pick the column with the maximum threatScore.
    let bestCol: number | null = null;
    let bestScore = -Infinity;
    for (const [col, score] of threatScores.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }

    console.info(
      `[findOpenThreeBlock] blocking column=${bestCol} with score=${bestScore}`
    );
    return bestCol;

  } catch (err) {
    console.error('[findOpenThreeBlock] unexpected error', err);
    return null;
  }
}

/**
 * Count all “3-in-a-row + 1 gap” fork threats the opponent will have
 * if you don’t block—logging each threat and deduplicating by gap+dir.
 *
 * @param board 6×7 grid of CellValue
 * @param opp   Opponent’s disc ('Red' or 'Yellow')
 * @returns Number of simultaneous open-three threats
 */
// 1a) Count all 3+gap forks you’d hand over
export function countOpenThree(
  board: CellValue[][],
  opp: CellValue
): number {
  try {
    const ROWS = board.length;
    const COLS = board[0].length;
    const WINDOW = 4;

    // Helper to key a threat by its gap cell + direction.
    const dirKey = (dr: number, dc: number): string => {
      if (dr === 0 && dc === 1) {
        return 'horiz';
      }

      if (dr === 1 && dc === 0) {
        return 'vert';
      }

      if (dr === 1 && dc === 1) {
        return 'diagDR';
      }

      if (dr === 1 && dc === -1) {
        return 'diagDL';
      }

      return `d${dr}c${dc}`;
    };

    const seen = new Set<string>();
    let threatCount = 0;

    const dirs = [
      { dr: 0, dc: 1 },
      { dr: 1, dc: 0 },
      { dr: 1, dc: 1 },
      { dr: 1, dc: -1 },
    ];

    for (const { dr, dc } of dirs) {
      const key = dirKey(dr, dc);

      // Slide a WINDOW x 1 window across the board in this direction.
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cells: CellValue[] = [];
          const coords: [number, number][] = [];

          for (let i = 0; i < WINDOW; i++) {
            const rr = r + dr * i;
            const cc = c + dc * i;

            if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS)
              break;

            cells.push(board[rr][cc]);
            coords.push([rr, cc]);
          }

          if (cells.length < WINDOW)
            continue;

          const oppCnt = cells.filter(x => x === opp).length;
          const empCnt = cells.filter(x => x === 'Empty').length;

          if (oppCnt === 3 && empCnt === 1) {
            const gapIdx = cells.findIndex(x => x === 'Empty');
            const [gapRow, gapCol] = coords[gapIdx];

            // Gravity check: can a disc actually drop here?
            if (gapRow === ROWS - 1 || board[gapRow + 1][gapCol] !== 'Empty') {
              // Unique key per gap + direction.
              const threatKey = `${gapRow}, ${gapCol}, ${key}`;

              if (!seen.has(threatKey)) {
                seen.add(threatKey);
                threatCount++;

                console.info(
                  `[countOpenThree] #${threatCount}: dir=${key}, ` +
                  `gap at (${gapRow}, ${gapCol}), ` +
                  `window origin=(${r},${c})`
                );
              }
            }
          }
        }
      }
    }

    console.info(
      `[countOpenThree] Total distinct 3 + gap threats detected: ${threatCount}`
    );

    return threatCount;

  } catch (err) {
    console.error('[countOpenThree] Unexpected error:', err);
    return 0;
  }
}

// Revised getBestAIMove integrating both strategies
export function getBestAIMove(
  board: CellValue[][],
  aiDisc: CellValue,
  timeMs = 200
): number {
  const moves = legalMoves(board);
  const totalCells = board.length * board[0].length;
  const emptyCells = board.reduce(
    (sum, row) => sum + row.filter(c => c === 'Empty').length,
    0
  );
  const oppDisc = aiDisc === 'Red' ? 'Yellow' : 'Red';

  // 0a) Immediate AI win
  for (const col of moves) {
    const { board: afterAI } = tryDrop(board, col, aiDisc);
    if (bitboardCheckWin(getBits(afterAI, aiDisc))) {
      return col;
    }
  }

  // 0b) Immediate opponent win => block
  for (const col of moves) {
    const { board: afterOpp } = tryDrop(board, col, oppDisc);
    if (bitboardCheckWin(getBits(afterOpp, oppDisc))) {
      return col;
    }
  }

  // 0c) Hard block: first open‑three fork
  const hardBlock = findOpenThreeBlock(board, oppDisc);
  if (hardBlock !== null) {
    return hardBlock;
  }

  // 1) Threat‑count scan: direct wins + all open‑three forks
  const threatCounts: Record<number, number> = {};
  for (const col of moves) {
    const { board: b1 } = tryDrop(board, col, aiDisc);

    // A) direct winning replies
    let cnt = legalMoves(b1).filter(reply => {
      const { board: b2 } = tryDrop(b1, reply, oppDisc);
      return bitboardCheckWin(getBits(b2, oppDisc));
    }).length;

    // B) all fork threats
    cnt += countOpenThree(b1, oppDisc);

    threatCounts[col] = cnt;
  }

  // 2) Filter by minimal threats
  let candidates = moves.filter(c => threatCounts[c] <= THREAT_THRESHOLD);
  if (candidates.length === 0) {
    const minT = Math.min(...moves.map(c => threatCounts[c]));
    candidates = moves.filter(c => threatCounts[c] === minT);
  }

  // 3) Sort by safety then center
  candidates.sort((a, b) =>
    threatCounts[a] - threatCounts[b] || Math.abs(3 - a) - Math.abs(3 - b)
  );

  const isEarly = emptyCells > totalCells * 0.6;
  const isLate = candidates.length <= 5;

  // 4) Late‑game: iterative‑deepening minimax
  if (isLate) {
    let bestMove: number | null = null;
    const maxD = Math.min(ENGINE_MAX_DEPTH, emptyCells);
    for (let d = 4; d <= maxD; d += 2) {
      const { column } = minimax(board, d, -Infinity, Infinity, true, aiDisc);
      if (column !== null && candidates.includes(column)) {
        bestMove = column;
      }
    }
    return bestMove !== null ? bestMove : candidates[0];
  }

  // 5) Early‑game: MCTS
  if (isEarly) {
    const col = mcts(board, aiDisc, timeMs);
    return candidates.includes(col) ? col : candidates[0];
  }

  // 6) Mid‑game fallback: one full‑depth minimax
  {
    const depth = Math.min(ENGINE_MAX_DEPTH, emptyCells);
    const { column } = minimax(board, depth, -Infinity, Infinity, true, aiDisc);
    return column !== null && candidates.includes(column)
      ? column
      : candidates[0];
  }
}
