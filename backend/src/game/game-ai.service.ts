import { Injectable, Logger } from '@nestjs/common';
import { getBestAIMove } from '../ai/connect4AI';
import type { CellValue } from '../ai/connect4AI';

/**
 * Service encapsulating AI logic for Connect Four using Minimax.
 */
@Injectable()
export class GameAIService {
  private readonly logger = new Logger(GameAIService.name);
  /**
   * Determine the AI's best column move for the current board state.
   *
   * @param board - 6×7 grid as a 2D array of CellValue ("Empty", "Red", or "Yellow").
   * @param aiDisc - The disc color for the AI (default: "Yellow").
   * @returns Index of the column (0-6) where the AI chooses to drop its disc.
   */
  getNextMove(
    board: CellValue[][],
    aiDisc: CellValue = 'Yellow',
    timeMs = 200
  ): number {
    this.logger.debug(`→ [AI] getNextMove start: disc=${aiDisc}, timeBudget=${timeMs}ms`);
    const t0 = performance.now();
    const col = getBestAIMove(board, aiDisc, timeMs);
    const dt = (performance.now() - t0).toFixed(1);
    this.logger.debug(`← [AI] chose column ${col} in ${dt}ms`);
    return col;
  }
}
