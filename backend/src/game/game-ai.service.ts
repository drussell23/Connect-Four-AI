import { Injectable } from '@nestjs/common';
import { getBestAIMove } from '../ai/aiEngine';
import type { CellValue } from '../ai/types';

/**
 * Service encapsulating AI logic for Connect Four using Minimax.
 */
@Injectable()
export class GameAIService {
  /**
   * Determine the AI's best column move for the current board state.
   *
   * @param board - 6×7 grid as a 2D array of CellValue ("Empty", "Red", or "Yellow").
   * @param aiDisc - The disc color for the AI (default: "Yellow").
   * @returns Index of the column (0-6) where the AI chooses to drop its disc.
   */
  getNextMove(board: CellValue[][], aiDisc: CellValue = 'Yellow'): number {
    return getBestAIMove(board, aiDisc);
  }
}
