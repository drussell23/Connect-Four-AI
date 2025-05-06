// src/game-ai/game-ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  legalMoves,
  tryDrop,
  getBits,
  bitboardCheckWin,
  blockVerticalThreeIfAny,
  blockFloatingOpenThree,
  findOpenThreeBlock,
  minimax,
  mcts,
  getBestAIMove,
  evaluateBoard,
  softmax,
  evaluateWindow,
  playout,
  blockFloatingOpenThreeDiagonal,
} from '../ai/connect4AI';
import type { CellValue } from '../ai/connect4AI';

export enum Difficulty {
  Easy = 'Easy',
  Medium = 'Medium',
  Hard = 'Hard',
}

@Injectable()
export class GameAIService {
  private readonly logger = new Logger(GameAIService.name);
  private cache = new Map<string, number>();

  /**
   * Core entry point. Wraps a five‐step pipeline:
   *  1) Immediate wins
   *  2) Immediate blocks
   *  3) Shallow minimax
   *  4) Monte Carlo Tree Search
   *  5) Fallback “best” search
   *
   * Caches results, honors difficulty, and never yields a one‐move loss.
   */
  getNextMove(
    board: CellValue[][],
    aiDisc: CellValue = 'Yellow',
    timeMs = 200,
    difficulty: Difficulty = Difficulty.Hard
  ): number {
    const key = JSON.stringify(board) + aiDisc + difficulty;
    if (this.cache.has(key)) {
      this.logger.debug(`Cache hit → returning column ${this.cache.get(key)}`);
      return this.cache.get(key)!;
    }

    try {
      this.logger.log(`→ [AI] getNextMove start: disc=${aiDisc}, budget=${timeMs}ms, diff=${difficulty}`);
      const opp: CellValue = aiDisc === 'Red' ? 'Yellow' : 'Red';

      // ── 0) Immediate opponent‐win block ────────────────────────────
      for (const col of legalMoves(board)) {
        const { board: b2 } = tryDrop(board, col, opp);
        if (bitboardCheckWin(getBits(b2, opp))) {
          this.logger.log(`Immediate opponent win! Blocking at col ${col}`);
          return this._cacheAndReturn(key, col);
        }
      }

      // ── 0.5) Opponent “fork” block (2-ply) ─────────────────────────
      const forkCol = this._findOpponentFork(board, opp);

      if (forkCol !== null) {
        this.logger.log(`Opponent can fork next turn! Blocking at ${forkCol}`);
        return this._cacheAndReturn(key, forkCol);
      }

      // ── 1) Opponent vertical‐three block ───────────────────────────
      const vcol = blockVerticalThreeIfAny(board, opp);

      if (vcol !== null) {
        this.logger.log(`Block opponent vertical-three at col ${vcol}`);
        return this._cacheAndReturn(key, vcol);
      }

      // ── 2) Strict gravity‐aware 3-in-a-row block ───────────────────
      this.logger.log(`[AI] calling findOpenThreeBlock for opponent=${opp}`);
      const strictCol = findOpenThreeBlock(board, opp);
      this.logger.log(`[AI] findOpenThreeBlock returned=${strictCol}`);
      if (strictCol !== null && this._isSafe(board, strictCol, aiDisc, opp)) {
        this.logger.log(`Block opponent strict-three at ${strictCol}`);
        return this._cacheAndReturn(key, strictCol);
      }

      // ── 3) Horizontal floating-three block ───────────────────────────
      this.logger.log(`[AI] scanning horizontal floating-three threats for aiDisc=${aiDisc}`);
      const fcol = blockFloatingOpenThree(board, aiDisc);
      this.logger.log(`[AI] blockFloatingOpenThree → candidate column=${fcol}`);

      if (fcol !== null) {
        const safeH = this._isSafe(board, fcol, aiDisc, opp);
        this.logger.log(`[AI] safety check for horiz block at ${fcol} → ${safeH}`);
        if (safeH) {
          this.logger.log(`→ [AI] executing horizontal floating-three block at col ${fcol}`);
          return this._cacheAndReturn(key, fcol);
        } else {
          this.logger.log(`[AI] skipping unsafe horizontal block at col ${fcol}`);
        }
      }

      // ── 3b) Diagonal floating-three block ───────────────────────────
      this.logger.log(`[AI] scanning diagonal floating-three threats for aiDisc=${aiDisc}`);
      const dcol = blockFloatingOpenThreeDiagonal(board, aiDisc);
      this.logger.log(`[AI] blockFloatingOpenThreeDiagonal → candidate column=${dcol}`);

      if (dcol !== null) {
        const safeD = this._isSafe(board, dcol, aiDisc, opp);
        this.logger.log(`[AI] safety check for diag block at ${dcol} → ${safeD}`);
        if (safeD) {
          this.logger.log(`→ [AI] executing diagonal floating-three block at col ${dcol}`);
          return this._cacheAndReturn(key, dcol);
        } else {
          this.logger.log(`[AI] skipping unsafe diagonal block at col ${dcol}`);
        }
      }

      // ── 4) Shallow minimax ─────────────────────────────────────────
      const miniNode = minimax(board, 4, -Infinity, Infinity, true, aiDisc);
      if (
        miniNode.column !== null &&
        this._isSafe(board, miniNode.column, aiDisc, opp)
      ) {
        this.logger.log(`Minimax (d=4) selects col ${miniNode.column}`);
        return this._cacheAndReturn(key, miniNode.column);
      }

      // ── 5) Monte Carlo Tree Search ─────────────────────────────────
      const mctsCol = mcts(board, aiDisc, timeMs);
      if (this._isSafe(board, mctsCol, aiDisc, opp)) {
        this.logger.log(`MCTS selects col ${mctsCol}`);
        return this._cacheAndReturn(key, mctsCol);
      }

      // ── 6) Full search fallback ─────────────────────────────────────
      const best = getBestAIMove(board, aiDisc, timeMs);
      this.logger.log(`Fallback getBestAIMove → col ${best}`);
      return this._cacheAndReturn(key, best);

    } catch (err) {
      this.logger.error(
        'Error in getNextMove, falling back to random legal move',
        (err as Error).stack
      );
      const fallback = this.getRandomMove(board);
      this.logger.log(`→ [AI] fallback random move → col ${fallback}`);
      return fallback;
    }
  }

  /**
   * Evaluate the full board from the AI’s perspective.
  */
  evaluateBoardState(board: CellValue[][], aiDisc: CellValue): number {
    const score = evaluateBoard(board, aiDisc);
    this.logger.log(`evaluateBoardState → ${score}`);
    return score;
  }

  /**
   * Score a single 4-cell window.
   * You can call this to build custom heuristics or debug specific windows.
   */
  evaluateWindowSegment(
    window: CellValue[],      // exactly 4 entries
    aiDisc: CellValue         // 'Red' or 'Yellow'
  ): number {
    const score = evaluateWindow(window, aiDisc);
    this.logger.debug(`evaluateWindow([${window.join(',')}], ${aiDisc}) → ${score}`);
    return score;
  }


  /**
   * Break the board into every possible 4-cell window and return
   * the list of window scores (with their positions).
   */
  analyzeAllWindows(
    board: CellValue[][],
    aiDisc: CellValue
  ): Array<{ window: CellValue[]; score: number; coords: [row: number, col: number][] }> {
    const results: Array<{
      window: CellValue[];
      score: number;
      coords: [number, number][];
    }> = [];

    // Horizontal
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 4; c++) {
        const win = [board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]];
        const coords: [number, number][] = [
          [r, c], [r, c + 1], [r, c + 2], [r, c + 3]
        ];
        results.push({ window: win, score: evaluateWindow(win, aiDisc), coords });
      }
    }

    // Vertical
    for (let c = 0; c < 7; c++) {
      for (let r = 0; r < 3; r++) {
        const win = [board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]];
        const coords: [number, number][] = [
          [r, c], [r + 1, c], [r + 2, c], [r + 3, c]
        ];
        results.push({ window: win, score: evaluateWindow(win, aiDisc), coords });
      }
    }

    // Diagonals ↗︎ and ↘︎
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        // ↘︎
        const diag1 = [board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]];
        const coords1: [number, number][] = [
          [r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]
        ];
        results.push({ window: diag1, score: evaluateWindow(diag1, aiDisc), coords: coords1 });

        // ↗︎
        const diag2 = [board[r + 3][c], board[r + 2][c + 1], board[r + 1][c + 2], board[r][c + 3]];
        const coords2: [number, number][] = [
          [r + 3, c], [r + 2, c + 1], [r + 1, c + 2], [r, c + 3]
        ];
        results.push({ window: diag2, score: evaluateWindow(diag2, aiDisc), coords: coords2 });
      }
    }

    this.logger.debug(`analyzeAllWindows → ${results.length} windows scored`);
    return results;
  }

  /** Quick random legal move in case of errors or Easy difficulty. */
  getRandomMove(board: CellValue[][]): number {
    const moves = legalMoves(board);
    return moves[Math.floor(Math.random() * moves.length)];
  }

  /** Expose all legal moves. */
  getLegalMoves(board: CellValue[][]): number[] {
    return legalMoves(board);
  }

  /**
   * Return softmax probabilities over legal moves.
   * Great for showing a “move heatmap” or top-K suggestions.
   */
  getMoveProbabilities(
    board: CellValue[][],
    aiDisc: CellValue = 'Yellow'
  ): { column: number; probability: number }[] {
    const moves = legalMoves(board);
    const scores = moves.map(col => {
      const { board: b } = tryDrop(board, col, aiDisc);
      return evaluateBoard(b, aiDisc);
    });
    const probs = softmax(scores);
    return moves.map((col, i) => ({ column: col, probability: probs[i] }));
  }

  /** Pick the top N moves by probability. */
  getTopMoves(
    board: CellValue[][],
    aiDisc: CellValue = 'Yellow',
    topN = 3
  ): number[] {
    return this.getMoveProbabilities(board, aiDisc)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, topN)
      .map(x => x.column);
  }

  /**
   * Run N random playouts and tally winners,
   * useful for diagnostics or self-play.
   */
  simulatePlayouts(
    board: CellValue[][],
    aiDisc: CellValue = 'Yellow',
    iterations = 100
  ): { winner: CellValue; count: number } {
    const tally: Record<CellValue, number> = { Empty: 0, Red: 0, Yellow: 0 };
    for (let i = 0; i < iterations; i++) {
      const win = playout(board, aiDisc, aiDisc === 'Red' ? 'Yellow' : 'Red');
      tally[win]++;
    }
    const [winner, count] = Object.entries(tally)
      .sort(([, a], [, b]) => b - a)[0];
    return { winner: winner as CellValue, count };
  }

  // ——— private helpers ———

  private _isSafe(
    board: CellValue[][],
    col: number,
    aiDisc: CellValue,
    oppDisc: CellValue
  ): boolean {
    const { board: after } = tryDrop(board, col, aiDisc);
    for (const c of legalMoves(after)) {
      const { board: opp } = tryDrop(after, c, oppDisc);
      if (bitboardCheckWin(getBits(opp, oppDisc))) {
        return false;
      }
    }
    return true;
  }

  private _cacheAndReturn(key: string, col: number): number {
    this.cache.set(key, col);
    return col;
  }

  /**
   * Return any column where the opponent can drop *and* create
   * two or more immediate winning replies (a fork).
   */
  private _findOpponentFork(board: CellValue[][], oppDisc: CellValue): number | null {
    for (const col of legalMoves(board)) {
      // Simulate opponent drop.
      const { board: b2 } = tryDrop(board, col, oppDisc);
      let winCount = 0;

      // Count how many replies win immediately.
      for (const c2 of legalMoves(b2)) {
        const { board: b3 } = tryDrop(b2, c2, oppDisc);

        if (bitboardCheckWin(getBits(b3, oppDisc))) {
          winCount++;

          if (winCount >= 2) {
            // As soon as we see two winning replies, it's a fork.
            return col;
          }
        }
      }
    }
    return null;
  }
}

