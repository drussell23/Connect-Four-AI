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
import { AIProfileService } from './ai-profile.service';

export enum Difficulty {
  Easy = 'Easy',
  Medium = 'Medium',
  Hard = 'Hard',
}

@Injectable()
export class GameAIService {
  private readonly logger = new Logger(GameAIService.name);
  private cache = new Map<string, number>();

  constructor(private readonly aiProfileService: AIProfileService) {
    const emptyBoard: CellValue[][] = Array.from({ length: 6 }, () => Array<CellValue>(7).fill('Empty'));
    const center = Math.floor(emptyBoard[0].length / 2);

    for (const disc of ['Yellow', 'Red'] as CellValue[]) {
      for (const diff of Object.values(Difficulty)) {
        const key = JSON.stringify(emptyBoard) + disc + diff;
        this.cache.set(key, center);
        this.logger.debug(`Pre-cached opening book → disc=${disc}, diff=${diff}, col=${center}`);
      }
    }
  }

  /**
   * Dynamically selects the AI's next move based on its current adaptive level.
   * The AI's level determines its difficulty and strategy.
   */
  getNextMove(
    board: CellValue[][],
    aiDisc: CellValue = 'Yellow',
    timeMs = 200,
  ): number {
    const aiLevel = this.aiProfileService.getCurrentLevel();
    let difficulty: Difficulty;

    if (aiLevel <= 2) {
      difficulty = Difficulty.Easy;
    } else if (aiLevel <= 5) {
      difficulty = Difficulty.Medium;
    } else {
      difficulty = Difficulty.Hard;
    }

    this.logger.log(`Current AI Level: ${aiLevel} -> Mapped to Difficulty: ${difficulty}`);

    const key = JSON.stringify(board) + aiDisc + difficulty;

    // Precompute opponent disc.
    const opp: CellValue = aiDisc === 'Red' ? 'Yellow' : 'Red';

    if (this.cache.has(key)) {
      this.logger.debug(`Cache hit [${key.slice(-10)}] → col ${this.cache.get(key)}`);
      return this.cache.get(key)!;
    }

    const overallStart = performance.now();
    this.logger.log(
      `→ [AI] getNextMove START: disc=${aiDisc} diff=${difficulty} budget=${timeMs}ms boardHash=${key.slice(-10)}`
    );

    // Count total discs on the board to identify opening moves.
    const discCount = board.flat().filter(c => c !== 'Empty').length;

    // Opening book: if it's the AI's first move (as P2), play center or adjacent.
    if (discCount === 1) {
      const center = Math.floor(board[0].length / 2);
      // Check if center column is available (bottom row is index 5).
      if (board[5][center] === 'Empty') {
        this.logger.log(`Opening Book (P2): Center available, picking ${center}`);
        return this._cacheAndReturn(key, center);
      } else {
        // Center is taken, pick a random adjacent column.
        const adjacentCols = [center - 1, center + 1].filter(c => c >= 0 && c < 7);
        this.logger.log(`Opening Book (P2): Center taken, picking from ${adjacentCols}`);
        return this._cacheAndReturn(key, adjacentCols[Math.floor(Math.random() * adjacentCols.length)]);
      }
    }

    // Opening book: on empty board, play center instantly;.
    try {
      const tOpen = performance.now();
      const isEmpty = board.every(row => row.every(cell => cell === 'Empty'));

      if (isEmpty) {
        const center = Math.floor(board[0].length / 2);
        const openMs = (performance.now() - tOpen).toFixed(3);

        this.logger.debug(`Opening-book check in ${openMs}ms → center ${center}`);

        return this._cacheAndReturn(key, center);
      }

      const openMs = (performance.now() - tOpen).toFixed(3);

      this.logger.debug(`Opening-book (non-empty) check in ${openMs}ms`);
    } catch (e) {
      this.logger.warn(`Opening-book ERROR: ${(e as Error).message}`);
    }

    // Count empties.
    const empties = board.flat().filter(c => c === 'Empty').length;

    // Only do a deep, perfect‐play solve in Hard endgames.
    if (difficulty === Difficulty.Hard && empties <= 12) {
      try {
        const solveStart = performance.now();
        this.logger.log(`Endgame HARD: ${empties} empties, doing full‐depth minimax`);

        // Full‐depth solve: look ahead through every remaining move.
        const full = minimax(board, empties, -Infinity, Infinity, true, aiDisc);

        const solveTime = performance.now() - solveStart;
        this.logger.log(
          `Endgame solve complete in ${solveTime.toFixed(2)}ms → col=${full.column}`
        );

        // Warn if it took unexpectedly long
        if (solveTime > 100) {
          this.logger.warn(
            `Endgame solve took ${solveTime.toFixed(2)}ms, consider lowering threshold`
          );
        }

        // Validate the move is safe
        if (
          full.column !== null &&
          this._isSafe(board, full.column, aiDisc, opp)
        ) {
          return this._cacheAndReturn(key, full.column);
        } else {
          this.logger.warn(
            `Endgame solve move ${full.column} deemed unsafe, falling back`
          );
        }
      } catch (err) {
        this.logger.error(
          `Endgame HARD solve ERROR: ${(err as Error).message}`
        );
      }

      // As a last‐resort, fall back to MCTS or best‐move search
      this.logger.log(`Endgame fallback → MCTS`);
      const mctsCol = mcts(board, aiDisc, timeMs);
      return this._cacheAndReturn(key, mctsCol);
    }

    // ── Step –1: If AI can win immediately, do that ───────────────
    try {
      const t0 = performance.now();

      for (const col of legalMoves(board)) {
        const { board: b2 } = tryDrop(board, col, aiDisc);

        if (bitboardCheckWin(getBits(b2, aiDisc))) {
          this.logger.log(`Step-1 WIN: AI wins at col ${col}`);
          return this._cacheAndReturn(key, col);
        }
      }
      this.logger.debug(`Step-1 COMPLETE in ${(performance.now() - t0).toFixed(2)}ms`);
    } catch (e) {
      this.logger.warn(`Step-1 ERROR: ${(e as Error).message}`);
    }


    try {
      // Step 0: Immediate opponent-win block
      try {
        const stepStart = performance.now();

        for (const col of legalMoves(board)) {
          const { board: next } = tryDrop(board, col, opp);

          if (bitboardCheckWin(getBits(next, opp))) {
            this.logger.log(`Step0 BLOCK: opponent win at ${col}`);
            return this._cacheAndReturn(key, col);
          }
        }
        this.logger.debug(
          `Step0 COMPLETE in ${((performance.now() - stepStart).toFixed(2))}ms`
        );
      } catch (e) {
        this.logger.warn(`Step0 ERROR: ${(e as Error).message}`);
      }

      // Branch by difficulty
      switch (difficulty) {
        case Difficulty.Easy: {
          try {
            this.logger.debug('Easy mode: skipping deeper analysis');
            const choice = this.getRandomMove(board);
            this.logger.log(`Easy fallback → ${choice}`);

            return this._cacheAndReturn(key, choice);
          } catch (e) {
            this.logger.error(`Easy fallback ERROR: ${(e as Error).stack}`);
            throw e;
          }
        }

        case Difficulty.Medium: {
          // Steps 0.5–4
          try {
            const stageStart = performance.now();
            // Fork block

            const fork = this._findOpponentFork(board, opp);

            if (fork !== null) {
              this.logger.log(`Step0.5 FORK: block at ${fork}`);
              return this._cacheAndReturn(key, fork);
            }

            // Vertical block
            const vcol = blockVerticalThreeIfAny(board, opp);

            if (vcol !== null) {
              this.logger.log(`Step1 VERT: block at ${vcol}`);
              return this._cacheAndReturn(key, vcol);
            }

            // Strict three
            const strict = findOpenThreeBlock(board, opp);
            this.logger.debug(`Step2 STRICT→${strict}`);

            if (strict !== null && this._isSafe(board, strict, aiDisc, opp)) {
              this.logger.log(`Step2 BLOCK at ${strict}`);
              return this._cacheAndReturn(key, strict);
            }

            // Horizontal float
            const hf = blockFloatingOpenThree(board, aiDisc);
            this.logger.debug(`Step3a HFLT→${hf}`);

            if (hf !== null && this._isSafe(board, hf, aiDisc, opp)) {
              this.logger.log(`Step3a BLOCK at ${hf}`);
              return this._cacheAndReturn(key, hf);
            }

            // Diagonal float
            const df = blockFloatingOpenThreeDiagonal(board, aiDisc);
            this.logger.debug(`Step3b DFLT→${df}`);

            if (df !== null && this._isSafe(board, df, aiDisc, opp)) {
              this.logger.log(`Step3b BLOCK at ${df}`);
              return this._cacheAndReturn(key, df);
            }

            // Minimax
            const mini = minimax(board, 4, -Infinity, Infinity, true, aiDisc);
            this.logger.debug(
              `Step4 MINMX: col=${mini.column} score=${mini.score}`
            );

            if (
              mini.column !== null &&
              this._isSafe(board, mini.column, aiDisc, opp)
            ) {
              this.logger.log(`Step4 PICK: ${mini.column}`);
              return this._cacheAndReturn(key, mini.column);
            }

            this.logger.debug(
              `StageMedium COMPLETE in ${(
                performance.now() - stageStart
              ).toFixed(2)}ms`
            );
          } catch (e) {
            this.logger.warn(`Medium pipeline ERROR: ${(e as Error).message}`);
          }
          // Fallback
          const medBest = getBestAIMove(board, aiDisc, timeMs);
          this.logger.log(`Medium fallback → ${medBest}`);
          return this._cacheAndReturn(key, medBest);
        }

        case Difficulty.Hard:
        default: {
          // Full pipeline including MCTS + combined softmax fallback
          try {
            const hardStart = performance.now();
            // reuse Medium initial logic

            const forkH = this._findOpponentFork(board, opp);

            if (forkH !== null) {
              this.logger.log(`Step0.5H FORK at ${forkH}`);
              return this._cacheAndReturn(key, forkH);
            }

            const vH = blockVerticalThreeIfAny(board, opp);

            if (vH !== null) {
              this.logger.log(`Step1H VERT at ${vH}`);
              return this._cacheAndReturn(key, vH);
            }

            const sH = findOpenThreeBlock(board, opp);
            this.logger.debug(`Step2H STRICT→${sH}`);

            if (sH !== null && this._isSafe(board, sH, aiDisc, opp)) {
              this.logger.log(`Step2H BLOCK at ${sH}`);
              return this._cacheAndReturn(key, sH);
            }

            const hH = blockFloatingOpenThree(board, aiDisc);
            this.logger.debug(`Step3aH HFLT→${hH}`);

            if (hH !== null && this._isSafe(board, hH, aiDisc, opp)) {
              this.logger.log(`Step3aH BLOCK at ${hH}`);
              return this._cacheAndReturn(key, hH);
            }

            const dH = blockFloatingOpenThreeDiagonal(board, aiDisc);
            this.logger.debug(`Step3bH DFLT→${dH}`);

            if (dH !== null && this._isSafe(board, dH, aiDisc, opp)) {
              this.logger.log(`Step3bH BLOCK at ${dH}`);
              return this._cacheAndReturn(key, dH);
            }

            const miniH = minimax(board, 4, -Infinity, Infinity, true, aiDisc);
            this.logger.debug(
              `Step4H MINMX: col=${miniH.column} score=${miniH.score}`
            );

            if (
              miniH.column !== null &&
              this._isSafe(board, miniH.column, aiDisc, opp)
            ) {
              this.logger.log(`Step4H PICK at ${miniH.column}`);
              return this._cacheAndReturn(key, miniH.column);
            }

            const mctsC = mcts(board, aiDisc, timeMs);
            this.logger.debug(`Step5H MCTS→${mctsC}`);

            if (this._isSafe(board, mctsC, aiDisc, opp)) {
              this.logger.log(`Step5H PICK at ${mctsC}`);
              return this._cacheAndReturn(key, mctsC);
            }

            // Combined softmax + full-search
            const bestCol = getBestAIMove(board, aiDisc, timeMs);

            this.logger.log(`getBestAIMove → ${bestCol}`);

            const probs = this.getMoveProbabilities(board, aiDisc);
            const sorted = probs.slice().sort((a, b) => b.probability - a.probability);
            const top = sorted[0];
            const obj = probs.find(x => x.column === bestCol);
            const bestProb = obj?.probability ?? 0;

            this.logger.log(
              `softmax top=${top.column}(p=${top.probability.toFixed(2)}), ` +
              `bestAIMove p=${bestProb.toFixed(2)}`
            );
            const finalC = top.probability > bestProb ? top.column : bestCol;
            this.logger.log(`Combined PICK → ${finalC}`);

            this.logger.log(
              `Hard pipeline COMPLETE in ${(
                performance.now() - hardStart
              ).toFixed(2)}ms`
            );
            return this._cacheAndReturn(key, finalC);
          } catch (e) {
            this.logger.warn(`Hard pipeline ERROR: ${(e as Error).message}`);
          }
          // Hard fallback: random
          const rnd = this.getRandomMove(board);
          this.logger.log(`Hard random fallback → ${rnd}`);
          return this._cacheAndReturn(key, rnd);
        }
      }
    } catch (err) {
      this.logger.error(
        `getNextMove FAILED (${(err as Error).message}), random fallback`,
        (err as Error).stack
      );

      const fb = this.getRandomMove(board);
      this.logger.log(`Global fallback → ${fb}`);

      return fb;
    } finally {
      const total = (performance.now() - overallStart).toFixed(2);
      this.logger.debug(`getNextMove END: totalTime=${total}ms`);
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
    try {
      this.logger.debug(`[AI] getRandomMove called. Moves: ${legalMoves(board).length}`);

      const moves = legalMoves(board);

      if (!moves.length)
        throw new Error('No legal moves available');

      const choice = moves[Math.floor(Math.random() * moves.length)];

      this.logger.debug(`[AI] getRandomMove picks column ${choice}`);
      return choice;
    } catch (error) {
      this.logger.error(`[AI] getRandomMove error: ${(error as Error).message}. Defaulting to center.`);
      return Math.floor((board[0].length - 1) / 2);
    }
  }

  /** Expose all legal moves. */
  getLegalMoves(board: CellValue[][]): number[] {
    try {
      this.logger.debug(`[AI] getLegalMoves called. Board snapshot: ${JSON.stringify(board).slice(0, 100)}`);

      const moves = legalMoves(board);
      const center = (board[0].length - 1) / 2;
      const sorted = moves.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));

      this.logger.debug(`[AI] getLegalMoves returns: [${sorted.join(', ')}]`);

      return sorted;
    } catch (error) {
      this.logger.error(`[AI] getLegalMoves error: ${(error as Error).message}`);
      return [];
    }
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

