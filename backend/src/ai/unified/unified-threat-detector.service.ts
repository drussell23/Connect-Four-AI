import { Injectable, Logger } from '@nestjs/common';

export type CellValue = 'Red' | 'Yellow' | 'Empty';
export type Board = CellValue[][];

export interface ThreatInfo {
  column: number;
  row: number;
  type: 'win' | 'block' | 'setup' | 'fork';
  direction?: 'horizontal' | 'vertical' | 'diagonal_asc' | 'diagonal_desc';
  urgency: number; // 0-1, where 1 is most urgent
  description: string;
}

export interface ThreatAnalysis {
  immediateWins: ThreatInfo[];
  immediateBlocks: ThreatInfo[];
  setupMoves: ThreatInfo[];
  forkThreats: ThreatInfo[];
  bestMove: number;
  confidence: number;
}

/**
 * Unified Threat Detection Service
 * Provides consistent threat detection logic for all AI systems
 */
@Injectable()
export class UnifiedThreatDetectorService {
  private readonly logger = new Logger(UnifiedThreatDetectorService.name);
  private readonly ROWS = 6;
  private readonly COLS = 7;

  /**
   * Analyze the board for all threats and opportunities
   */
  analyzeBoardThreats(
    board: Board,
    aiColor: CellValue,
    opponentColor: CellValue
  ): ThreatAnalysis {
    const analysis: ThreatAnalysis = {
      immediateWins: [],
      immediateBlocks: [],
      setupMoves: [],
      forkThreats: [],
      bestMove: -1,
      confidence: 0
    };

    // Check each column for possible moves
    for (let col = 0; col < this.COLS; col++) {
      const row = this.getDropRow(board, col);
      if (row === -1) continue; // Column full

      // Check for immediate win
      const winThreat = this.checkMoveCreatesWin(board, row, col, aiColor);
      if (winThreat) {
        analysis.immediateWins.push({
          column: col,
          row,
          type: 'win',
          direction: winThreat.direction,
          urgency: 1.0,
          description: `Winning move at column ${col}`
        });
      }

      // Check for blocking opponent win
      const blockThreat = this.checkMoveCreatesWin(board, row, col, opponentColor);
      if (blockThreat) {
        analysis.immediateBlocks.push({
          column: col,
          row,
          type: 'block',
          direction: blockThreat.direction,
          urgency: 0.95,
          description: `Block opponent win at column ${col}`
        });
      }

      // Check for setup moves (creates threat on next turn)
      const setupThreats = this.checkSetupMoves(board, row, col, aiColor, opponentColor);
      analysis.setupMoves.push(...setupThreats);

      // Check for fork opportunities
      const forkThreats = this.checkForkThreats(board, row, col, aiColor, opponentColor);
      analysis.forkThreats.push(...forkThreats);
    }

    // Determine best move based on threat analysis
    analysis.bestMove = this.selectBestMove(analysis);
    analysis.confidence = this.calculateConfidence(analysis);

    this.logger.log(`Threat Analysis Complete: ${JSON.stringify({
      wins: analysis.immediateWins.length,
      blocks: analysis.immediateBlocks.length,
      setups: analysis.setupMoves.length,
      forks: analysis.forkThreats.length,
      bestMove: analysis.bestMove,
      confidence: analysis.confidence
    })}`);

    return analysis;
  }

  /**
   * Quick threat detection for time-critical situations
   */
  getImmediateThreat(
    board: Board,
    aiColor: CellValue,
    opponentColor: CellValue
  ): number {
    // First check for immediate wins
    for (let col = 0; col < this.COLS; col++) {
      const row = this.getDropRow(board, col);
      if (row === -1) continue;

      if (this.checkMoveCreatesWin(board, row, col, aiColor)) {
        return col; // Take the win
      }
    }

    // Then check for immediate blocks
    for (let col = 0; col < this.COLS; col++) {
      const row = this.getDropRow(board, col);
      if (row === -1) continue;

      if (this.checkMoveCreatesWin(board, row, col, opponentColor)) {
        return col; // Block the opponent
      }
    }

    return -1; // No immediate threats
  }

  /**
   * Enhanced threat detection with pattern recognition
   */
  detectComplexThreats(board: Board, player: CellValue): ThreatInfo[] {
    const threats: ThreatInfo[] = [];
    
    // Detect various threat patterns
    threats.push(...this.detectConnectedThreats(board, player));
    threats.push(...this.detectSplitThreats(board, player));
    threats.push(...this.detectDiagonalThreats(board, player));
    threats.push(...this.detectTrapSetups(board, player));
    
    return threats;
  }

  private getDropRow(board: Board, col: number): number {
    for (let row = this.ROWS - 1; row >= 0; row--) {
      if (board[row][col] === 'Empty') {
        return row;
      }
    }
    return -1; // Column full
  }

  private checkMoveCreatesWin(
    board: Board,
    row: number,
    col: number,
    player: CellValue
  ): { direction: 'horizontal' | 'vertical' | 'diagonal_asc' | 'diagonal_desc' } | null {
    // Temporarily place the piece
    board[row][col] = player;
    
    const directions: Array<{
      name: 'horizontal' | 'vertical' | 'diagonal_asc' | 'diagonal_desc';
      dr: number;
      dc: number;
    }> = [
      { name: 'horizontal', dr: 0, dc: 1 },
      { name: 'vertical', dr: 1, dc: 0 },
      { name: 'diagonal_asc', dr: 1, dc: 1 },
      { name: 'diagonal_desc', dr: 1, dc: -1 }
    ];

    for (const { name, dr, dc } of directions) {
      if (this.checkDirection(board, row, col, dr, dc, player) >= 4) {
        board[row][col] = 'Empty'; // Reset
        return { direction: name };
      }
    }

    board[row][col] = 'Empty'; // Reset
    return null;
  }

  private checkDirection(
    board: Board,
    row: number,
    col: number,
    dr: number,
    dc: number,
    player: CellValue
  ): number {
    let count = 1;

    // Check positive direction
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < this.ROWS && c >= 0 && c < this.COLS && board[r][c] === player) {
      count++;
      r += dr;
      c += dc;
    }

    // Check negative direction
    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < this.ROWS && c >= 0 && c < this.COLS && board[r][c] === player) {
      count++;
      r -= dr;
      c -= dc;
    }

    return count;
  }

  private checkSetupMoves(
    board: Board,
    row: number,
    col: number,
    aiColor: CellValue,
    opponentColor: CellValue
  ): ThreatInfo[] {
    const threats: ThreatInfo[] = [];
    
    // Temporarily place the piece
    board[row][col] = aiColor;

    // Check if this move creates a threat for next turn
    for (let nextCol = 0; nextCol < this.COLS; nextCol++) {
      const nextRow = this.getDropRow(board, nextCol);
      if (nextRow === -1) continue;

      // Simulate opponent's response
      board[nextRow][nextCol] = opponentColor;
      
      // Check if we can still create a winning threat
      let threatCount = 0;
      for (let finalCol = 0; finalCol < this.COLS; finalCol++) {
        const finalRow = this.getDropRow(board, finalCol);
        if (finalRow === -1) continue;

        if (this.checkMoveCreatesWin(board, finalRow, finalCol, aiColor)) {
          threatCount++;
        }
      }

      board[nextRow][nextCol] = 'Empty'; // Reset opponent move

      if (threatCount >= 2) {
        threats.push({
          column: col,
          row,
          type: 'setup',
          urgency: 0.7,
          description: `Setup move creating ${threatCount} threats`
        });
      }
    }

    board[row][col] = 'Empty'; // Reset
    return threats;
  }

  private checkForkThreats(
    board: Board,
    row: number,
    col: number,
    aiColor: CellValue,
    opponentColor: CellValue
  ): ThreatInfo[] {
    const threats: ThreatInfo[] = [];
    
    // Check if this move creates multiple winning threats
    board[row][col] = aiColor;
    
    let winningPositions = 0;
    const winningColumns: number[] = [];

    for (let checkCol = 0; checkCol < this.COLS; checkCol++) {
      const checkRow = this.getDropRow(board, checkCol);
      if (checkRow === -1) continue;

      if (this.checkMoveCreatesWin(board, checkRow, checkCol, aiColor)) {
        winningPositions++;
        winningColumns.push(checkCol);
      }
    }

    if (winningPositions >= 2) {
      threats.push({
        column: col,
        row,
        type: 'fork',
        urgency: 0.85,
        description: `Fork creating ${winningPositions} winning threats at columns ${winningColumns.join(', ')}`
      });
    }

    board[row][col] = 'Empty'; // Reset
    return threats;
  }

  private detectConnectedThreats(board: Board, player: CellValue): ThreatInfo[] {
    const threats: ThreatInfo[] = [];
    
    // Look for patterns like XX_X or X_XX where _ is empty
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS - 3; col++) {
        const pattern = board[row].slice(col, col + 4);
        const playerCount = pattern.filter(cell => cell === player).length;
        const emptyCount = pattern.filter(cell => cell === 'Empty').length;
        
        if (playerCount === 3 && emptyCount === 1) {
          const emptyIndex = pattern.indexOf('Empty');
          threats.push({
            column: col + emptyIndex,
            row,
            type: 'setup',
            direction: 'horizontal',
            urgency: 0.8,
            description: `Connected threat pattern at row ${row}`
          });
        }
      }
    }

    return threats;
  }

  private detectSplitThreats(board: Board, player: CellValue): ThreatInfo[] {
    const threats: ThreatInfo[] = [];
    
    // Look for split patterns like X__X with potential to become XXXX
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS - 3; col++) {
        if (board[row][col] === player && 
            board[row][col + 3] === player &&
            board[row][col + 1] === 'Empty' &&
            board[row][col + 2] === 'Empty') {
          threats.push({
            column: col + 1,
            row,
            type: 'setup',
            direction: 'horizontal',
            urgency: 0.6,
            description: `Split threat pattern at row ${row}`
          });
        }
      }
    }

    return threats;
  }

  private detectDiagonalThreats(board: Board, player: CellValue): ThreatInfo[] {
    const threats: ThreatInfo[] = [];
    
    // Check ascending diagonals
    for (let row = 3; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS - 3; col++) {
        let playerCount = 0;
        let emptyPositions: Array<{row: number, col: number}> = [];
        
        for (let i = 0; i < 4; i++) {
          if (board[row - i][col + i] === player) {
            playerCount++;
          } else if (board[row - i][col + i] === 'Empty') {
            emptyPositions.push({row: row - i, col: col + i});
          }
        }
        
        if (playerCount === 3 && emptyPositions.length === 1) {
          threats.push({
            column: emptyPositions[0].col,
            row: emptyPositions[0].row,
            type: 'setup',
            direction: 'diagonal_asc',
            urgency: 0.75,
            description: `Diagonal threat (ascending)`
          });
        }
      }
    }

    return threats;
  }

  private detectTrapSetups(board: Board, player: CellValue): ThreatInfo[] {
    const threats: ThreatInfo[] = [];
    
    // Detect positions that force opponent into bad moves
    for (let col = 0; col < this.COLS; col++) {
      const row = this.getDropRow(board, col);
      if (row === -1 || row === 0) continue; // Skip if column full or only bottom row available

      // Check if placing here forces opponent to enable our win
      board[row][col] = player;
      const forcedRow = row - 1;
      
      if (this.checkMoveCreatesWin(board, forcedRow, col, player)) {
        threats.push({
          column: col,
          row,
          type: 'setup',
          urgency: 0.65,
          description: `Trap setup forcing opponent to enable win`
        });
      }
      
      board[row][col] = 'Empty'; // Reset
    }

    return threats;
  }

  private selectBestMove(analysis: ThreatAnalysis): number {
    // Priority order: immediate wins > immediate blocks > forks > setups
    if (analysis.immediateWins.length > 0) {
      return analysis.immediateWins[0].column;
    }
    
    if (analysis.immediateBlocks.length > 0) {
      return analysis.immediateBlocks[0].column;
    }
    
    if (analysis.forkThreats.length > 0) {
      // Sort by urgency and take the best fork
      analysis.forkThreats.sort((a, b) => b.urgency - a.urgency);
      return analysis.forkThreats[0].column;
    }
    
    if (analysis.setupMoves.length > 0) {
      // Sort by urgency and take the best setup
      analysis.setupMoves.sort((a, b) => b.urgency - a.urgency);
      return analysis.setupMoves[0].column;
    }
    
    // Default to center column
    return 3;
  }

  private calculateConfidence(analysis: ThreatAnalysis): number {
    if (analysis.immediateWins.length > 0) return 1.0;
    if (analysis.immediateBlocks.length > 0) return 0.95;
    if (analysis.forkThreats.length > 0) return 0.85;
    if (analysis.setupMoves.length > 0) return 0.7;
    return 0.5;
  }
}