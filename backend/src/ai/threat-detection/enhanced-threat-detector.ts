import { CellValue } from '../connect4AI';

export interface Threat {
  type: 'win' | 'block' | 'open-three' | 'open-two' | 'fork' | 'setup';
  column: number;
  row: number;
  direction: 'horizontal' | 'vertical' | 'diagonal-right' | 'diagonal-left';
  priority: number; // 1-10, higher is more urgent
  player: CellValue;
  positions: Array<{ row: number; col: number }>;
}

export interface ThreatAnalysis {
  immediateWins: Threat[];
  immediateBlocks: Threat[];
  openThrees: Threat[];
  openTwos: Threat[];
  forks: Threat[];
  setups: Threat[];
  totalThreatScore: number;
}

export class EnhancedThreatDetector {
  private readonly DIRECTIONS = [
    { dr: 0, dc: 1, name: 'horizontal' },
    { dr: 1, dc: 0, name: 'vertical' },
    { dr: 1, dc: 1, name: 'diagonal-right' },
    { dr: 1, dc: -1, name: 'diagonal-left' }
  ];
  
  /**
   * Comprehensive threat analysis for a board state
   */
  analyzeThreat(board: CellValue[][], player: CellValue): ThreatAnalysis {
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    const analysis: ThreatAnalysis = {
      immediateWins: [],
      immediateBlocks: [],
      openThrees: [],
      openTwos: [],
      forks: [],
      setups: [],
      totalThreatScore: 0
    };
    
    // Check each column for potential moves
    for (let col = 0; col < 7; col++) {
      const row = this.getDropRow(board, col);
      if (row === -1) continue; // Column full
      
      // Simulate move for player
      board[row][col] = player;
      if (this.checkWin(board, player, row, col)) {
        analysis.immediateWins.push({
          type: 'win',
          column: col,
          row,
          direction: this.getWinDirection(board, player, row, col),
          priority: 10,
          player,
          positions: this.getWinPositions(board, player, row, col)
        });
      }
      board[row][col] = null; // Undo
      
      // Simulate move for opponent
      board[row][col] = opponent;
      if (this.checkWin(board, opponent, row, col)) {
        analysis.immediateBlocks.push({
          type: 'block',
          column: col,
          row,
          direction: this.getWinDirection(board, opponent, row, col),
          priority: 9,
          player: opponent,
          positions: this.getWinPositions(board, opponent, row, col)
        });
      }
      board[row][col] = null; // Undo
      
      // Check for open threes and other threats
      this.analyzePosition(board, row, col, player, analysis);
      this.analyzePosition(board, row, col, opponent, analysis);
    }
    
    // Detect forks (positions that create multiple threats)
    this.detectForks(board, player, analysis);
    this.detectForks(board, opponent, analysis);
    
    // Calculate total threat score
    analysis.totalThreatScore = this.calculateThreatScore(analysis);
    
    return analysis;
  }
  
  /**
   * Analyze a specific position for threats
   */
  private analyzePosition(
    board: CellValue[][], 
    row: number, 
    col: number, 
    player: CellValue,
    analysis: ThreatAnalysis
  ): void {
    // Temporarily place piece
    board[row][col] = player;
    
    for (const dir of this.DIRECTIONS) {
      const line = this.getLine(board, row, col, dir.dr, dir.dc);
      
      // Count consecutive pieces and empty spaces
      const pattern = this.analyzePattern(line, player);
      
      if (pattern.consecutive === 3 && pattern.openEnds >= 1) {
        // Open three detected
        analysis.openThrees.push({
          type: 'open-three',
          column: col,
          row,
          direction: dir.name as any,
          priority: 7,
          player,
          positions: this.getLinePositions(row, col, dir.dr, dir.dc, pattern.startIdx, pattern.length)
        });
      } else if (pattern.consecutive === 2 && pattern.openEnds === 2 && pattern.totalSpace >= 4) {
        // Open two with potential
        analysis.openTwos.push({
          type: 'open-two',
          column: col,
          row,
          direction: dir.name as any,
          priority: 5,
          player,
          positions: this.getLinePositions(row, col, dir.dr, dir.dc, pattern.startIdx, pattern.length)
        });
      } else if (pattern.consecutive === 2 && pattern.canExtend) {
        // Setup move
        analysis.setups.push({
          type: 'setup',
          column: col,
          row,
          direction: dir.name as any,
          priority: 3,
          player,
          positions: this.getLinePositions(row, col, dir.dr, dir.dc, pattern.startIdx, pattern.length)
        });
      }
    }
    
    // Remove temporary piece
    board[row][col] = null;
  }
  
  /**
   * Analyze a pattern in a line
   */
  private analyzePattern(line: (CellValue | null)[], player: CellValue): {
    consecutive: number;
    openEnds: number;
    totalSpace: number;
    canExtend: boolean;
    startIdx: number;
    length: number;
  } {
    let maxConsecutive = 0;
    let openEnds = 0;
    let totalSpace = 0;
    let canExtend = false;
    let bestStart = 0;
    let bestLength = 0;
    
    // Find the player's piece in the line
    const centerIdx = Math.floor(line.length / 2);
    
    // Look for patterns around the center
    for (let start = Math.max(0, centerIdx - 3); start <= Math.min(line.length - 4, centerIdx); start++) {
      const segment = line.slice(start, start + 4);
      const playerCount = segment.filter(c => c === player).length;
      const emptyCount = segment.filter(c => c === null || c === 'Empty').length;
      
      if (playerCount > 0 && playerCount + emptyCount === 4) {
        // Count consecutive pieces
        let consecutive = 0;
        let maxInSegment = 0;
        let currentRun = 0;
        
        for (const cell of segment) {
          if (cell === player) {
            currentRun++;
            maxInSegment = Math.max(maxInSegment, currentRun);
          } else {
            currentRun = 0;
          }
        }
        
        if (maxInSegment > maxConsecutive) {
          maxConsecutive = maxInSegment;
          bestStart = start;
          bestLength = 4;
          
          // Check open ends
          openEnds = 0;
          if (start > 0 && (line[start - 1] === null || line[start - 1] === 'Empty')) openEnds++;
          if (start + 4 < line.length && (line[start + 4] === null || line[start + 4] === 'Empty')) openEnds++;
          
          totalSpace = 4;
          canExtend = openEnds > 0;
        }
      }
    }
    
    return {
      consecutive: maxConsecutive,
      openEnds,
      totalSpace,
      canExtend,
      startIdx: bestStart,
      length: bestLength
    };
  }
  
  /**
   * Get a line of cells in a specific direction
   */
  private getLine(
    board: CellValue[][], 
    row: number, 
    col: number, 
    dr: number, 
    dc: number
  ): (CellValue | null)[] {
    const line: (CellValue | null)[] = [];
    
    // Go backwards first
    for (let i = 3; i >= 1; i--) {
      const r = row - i * dr;
      const c = col - i * dc;
      if (r >= 0 && r < 6 && c >= 0 && c < 7) {
        line.push(board[r][c]);
      }
    }
    
    // Add center position
    line.push(null); // This will be filled by the potential move
    
    // Go forwards
    for (let i = 1; i <= 3; i++) {
      const r = row + i * dr;
      const c = col + i * dc;
      if (r >= 0 && r < 6 && c >= 0 && c < 7) {
        line.push(board[r][c]);
      }
    }
    
    return line;
  }
  
  /**
   * Detect fork opportunities
   */
  private detectForks(board: CellValue[][], player: CellValue, analysis: ThreatAnalysis): void {
    for (let col = 0; col < 7; col++) {
      const row = this.getDropRow(board, col);
      if (row === -1) continue;
      
      // Simulate move
      board[row][col] = player;
      
      // Count threats created
      const threats: Threat[] = [];
      for (const dir of this.DIRECTIONS) {
        const line = this.getLine(board, row, col, dir.dr, dir.dc);
        const pattern = this.analyzePattern(line, player);
        
        if (pattern.consecutive >= 2 && pattern.openEnds >= 1) {
          threats.push({
            type: 'fork',
            column: col,
            row,
            direction: dir.name as any,
            priority: 0, // Will be set based on threat count
            player,
            positions: []
          });
        }
      }
      
      // If multiple threats created, it's a fork
      if (threats.length >= 2) {
        analysis.forks.push({
          type: 'fork',
          column: col,
          row,
          direction: 'horizontal', // Default, as fork spans multiple directions
          priority: Math.min(8, 5 + threats.length),
          player,
          positions: [{ row, col }]
        });
      }
      
      board[row][col] = null; // Undo
    }
  }
  
  /**
   * Calculate overall threat score
   */
  private calculateThreatScore(analysis: ThreatAnalysis): number {
    let score = 0;
    
    score += analysis.immediateWins.length * 1000;
    score += analysis.immediateBlocks.length * 900;
    score += analysis.forks.length * 500;
    score += analysis.openThrees.length * 300;
    score += analysis.openTwos.length * 100;
    score += analysis.setups.length * 50;
    
    return score;
  }
  
  /**
   * Helper methods
   */
  private getDropRow(board: CellValue[][], col: number): number {
    for (let row = 5; row >= 0; row--) {
      if (board[row][col] === null || board[row][col] === 'Empty') {
        return row;
      }
    }
    return -1;
  }
  
  private checkWin(board: CellValue[][], player: CellValue, row: number, col: number): boolean {
    // Check all four directions
    for (const dir of this.DIRECTIONS) {
      let count = 1;
      
      // Check forward
      for (let i = 1; i <= 3; i++) {
        const r = row + i * dir.dr;
        const c = col + i * dir.dc;
        if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
          count++;
        } else {
          break;
        }
      }
      
      // Check backward
      for (let i = 1; i <= 3; i++) {
        const r = row - i * dir.dr;
        const c = col - i * dir.dc;
        if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
          count++;
        } else {
          break;
        }
      }
      
      if (count >= 4) return true;
    }
    
    return false;
  }
  
  private getWinDirection(board: CellValue[][], player: CellValue, row: number, col: number): any {
    for (const dir of this.DIRECTIONS) {
      let count = 1;
      
      // Check forward
      for (let i = 1; i <= 3; i++) {
        const r = row + i * dir.dr;
        const c = col + i * dir.dc;
        if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
          count++;
        } else {
          break;
        }
      }
      
      // Check backward
      for (let i = 1; i <= 3; i++) {
        const r = row - i * dir.dr;
        const c = col - i * dir.dc;
        if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
          count++;
        } else {
          break;
        }
      }
      
      if (count >= 4) return dir.name;
    }
    
    return 'unknown';
  }
  
  private getWinPositions(board: CellValue[][], player: CellValue, row: number, col: number): Array<{ row: number; col: number }> {
    const positions: Array<{ row: number; col: number }> = [{ row, col }];
    
    for (const dir of this.DIRECTIONS) {
      const tempPositions = [{ row, col }];
      
      // Check forward
      for (let i = 1; i <= 3; i++) {
        const r = row + i * dir.dr;
        const c = col + i * dir.dc;
        if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
          tempPositions.push({ row: r, col: c });
        } else {
          break;
        }
      }
      
      // Check backward
      for (let i = 1; i <= 3; i++) {
        const r = row - i * dir.dr;
        const c = col - i * dir.dc;
        if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
          tempPositions.unshift({ row: r, col: c });
        } else {
          break;
        }
      }
      
      if (tempPositions.length >= 4) {
        return tempPositions.slice(0, 4);
      }
    }
    
    return positions;
  }
  
  private getLinePositions(
    row: number, 
    col: number, 
    dr: number, 
    dc: number, 
    startIdx: number, 
    length: number
  ): Array<{ row: number; col: number }> {
    const positions: Array<{ row: number; col: number }> = [];
    const startOffset = startIdx - 3; // Adjust for backward positions
    
    for (let i = 0; i < length; i++) {
      const r = row + (startOffset + i) * dr;
      const c = col + (startOffset + i) * dc;
      if (r >= 0 && r < 6 && c >= 0 && c < 7) {
        positions.push({ row: r, col: c });
      }
    }
    
    return positions;
  }
}