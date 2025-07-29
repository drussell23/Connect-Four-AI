import * as fs from 'fs/promises';
import * as path from 'path';

export type CellValue = 'Empty' | 'Red' | 'Yellow';
export type Board = CellValue[][];

interface OpeningEntry {
  column: number;
  score: number;
  winRate: number;
  drawRate: number;
  lossRate: number;
  playCount: number;
  depth: number;
  lastUpdated: Date;
}

interface OpeningData {
  [boardKey: string]: OpeningEntry[];
}

export class OpeningBook {
  private openings: Map<string, OpeningEntry[]> = new Map();
  private readonly BOARD_ROWS = 6;
  private readonly BOARD_COLS = 7;
  private readonly MAX_DEPTH = 15; // Maximum moves to track in opening book
  private readonly OPENING_BOOK_PATH = path.join(__dirname, 'opening-book-data.json');
  
  // Known strong opening sequences for Connect Four
  private readonly STANDARD_OPENINGS = {
    // Center column is theoretically best first move
    'empty': [{ column: 3, score: 0.6, winRate: 0.52, drawRate: 0.31, lossRate: 0.17 }],
    
    // Common opening patterns (simplified board keys)
    'center_start': [
      { column: 3, score: 0.55, winRate: 0.50, drawRate: 0.35, lossRate: 0.15 },
      { column: 2, score: 0.52, winRate: 0.48, drawRate: 0.36, lossRate: 0.16 },
      { column: 4, score: 0.52, winRate: 0.48, drawRate: 0.36, lossRate: 0.16 }
    ],
    
    // Response to opponent's center opening
    'opponent_center': [
      { column: 3, score: 0.58, winRate: 0.51, drawRate: 0.34, lossRate: 0.15 },
      { column: 2, score: 0.54, winRate: 0.49, drawRate: 0.35, lossRate: 0.16 },
      { column: 4, score: 0.54, winRate: 0.49, drawRate: 0.35, lossRate: 0.16 }
    ]
  };

  async load(): Promise<void> {
    try {
      // Try to load from file first
      const fileData = await fs.readFile(this.OPENING_BOOK_PATH, 'utf-8');
      const openingData: OpeningData = JSON.parse(fileData);
      
      // Convert dates and load into map
      for (const [key, entries] of Object.entries(openingData)) {
        this.openings.set(key, entries.map(entry => ({
          ...entry,
          lastUpdated: new Date(entry.lastUpdated)
        })));
      }
      
      console.log(`Loaded ${this.openings.size} opening positions from file`);
    } catch (error) {
      console.log('No existing opening book found, initializing with standard openings');
      this.initializeStandardOpenings();
    }
  }

  private initializeStandardOpenings(): void {
    // Empty board - center column is best
    const emptyBoard = this.createEmptyBoard();
    const emptyKey = this.getBoardKey(emptyBoard);
    this.openings.set(emptyKey, [{
      column: 3,
      score: 0.6,
      winRate: 0.52,
      drawRate: 0.31,
      lossRate: 0.17,
      playCount: 10000,
      depth: 0,
      lastUpdated: new Date()
    }]);

    // Add variations for first few moves
    this.addOpeningVariations();
  }

  private addOpeningVariations(): void {
    // Add common opening sequences
    const variations = [
      // Center-center opening
      { moves: [[3, 'Red'], [3, 'Yellow']], responses: [2, 4, 3] },
      // Center-adjacent opening
      { moves: [[3, 'Red'], [2, 'Yellow']], responses: [3, 4, 2] },
      { moves: [[3, 'Red'], [4, 'Yellow']], responses: [3, 2, 4] },
      // Edge opening responses
      { moves: [[0, 'Red']], responses: [3, 1, 2] },
      { moves: [[6, 'Red']], responses: [3, 5, 4] }
    ];

    for (const variation of variations) {
      const board = this.createEmptyBoard();
      let depth = 0;
      
      // Apply moves
      for (const [col, player] of variation.moves as [number, CellValue][]) {
        const row = this.getLowestEmptyRow(board, col);
        if (row !== -1) {
          board[row][col] = player;
          depth++;
        }
      }
      
      // Add responses
      const boardKey = this.getBoardKey(board);
      const entries: OpeningEntry[] = variation.responses.map((col, idx) => ({
        column: col,
        score: 0.55 - idx * 0.02,
        winRate: 0.50 - idx * 0.01,
        drawRate: 0.35,
        lossRate: 0.15 + idx * 0.01,
        playCount: 1000 - idx * 200,
        depth,
        lastUpdated: new Date()
      }));
      
      this.openings.set(boardKey, entries);
    }
  }

  async lookup(board: Board): Promise<number | null> {
    // Get normalized board keys (including symmetry)
    const boardKeys = this.getNormalizedBoardKeys(board);
    
    for (const key of boardKeys) {
      const entries = this.openings.get(key);
      if (entries && entries.length > 0) {
        // Return best move based on score
        const sortedEntries = [...entries].sort((a, b) => b.score - a.score);
        return sortedEntries[0].column;
      }
    }
    
    return null;
  }

  async lookupWithStats(board: Board): Promise<OpeningEntry[] | null> {
    const boardKeys = this.getNormalizedBoardKeys(board);
    
    for (const key of boardKeys) {
      const entries = this.openings.get(key);
      if (entries && entries.length > 0) {
        return [...entries].sort((a, b) => b.score - a.score);
      }
    }
    
    return null;
  }

  async updateEntry(board: Board, column: number, result: 'win' | 'draw' | 'loss'): Promise<void> {
    const boardKey = this.getBoardKey(board);
    let entries = this.openings.get(boardKey) || [];
    
    // Find or create entry for this column
    let entry = entries.find(e => e.column === column);
    if (!entry) {
      entry = {
        column,
        score: 0.5,
        winRate: 0,
        drawRate: 0,
        lossRate: 0,
        playCount: 0,
        depth: this.getBoardDepth(board),
        lastUpdated: new Date()
      };
      entries.push(entry);
    }
    
    // Update statistics
    entry.playCount++;
    const totalPlays = entry.playCount;
    
    if (result === 'win') {
      entry.winRate = ((entry.winRate * (totalPlays - 1)) + 1) / totalPlays;
    } else if (result === 'draw') {
      entry.drawRate = ((entry.drawRate * (totalPlays - 1)) + 1) / totalPlays;
    } else {
      entry.lossRate = ((entry.lossRate * (totalPlays - 1)) + 1) / totalPlays;
    }
    
    // Recalculate score (win = 1, draw = 0.5, loss = 0)
    entry.score = entry.winRate + (entry.drawRate * 0.5);
    entry.lastUpdated = new Date();
    
    this.openings.set(boardKey, entries);
  }

  async save(): Promise<void> {
    const openingData: OpeningData = {};
    
    for (const [key, entries] of this.openings.entries()) {
      openingData[key] = entries;
    }
    
    await fs.writeFile(
      this.OPENING_BOOK_PATH,
      JSON.stringify(openingData, null, 2),
      'utf-8'
    );
    
    console.log(`Saved ${this.openings.size} opening positions to file`);
  }

  private getBoardKey(board: Board): string {
    // Create a compact representation of the board
    return board.map(row => 
      row.map(cell => {
        if (cell === 'Empty') return '0';
        if (cell === 'Red') return '1';
        return '2';
      }).join('')
    ).join('|');
  }

  private getNormalizedBoardKeys(board: Board): string[] {
    const keys: string[] = [];
    
    // Original board
    keys.push(this.getBoardKey(board));
    
    // Horizontally flipped board (symmetry)
    const flippedBoard = this.flipBoardHorizontally(board);
    keys.push(this.getBoardKey(flippedBoard));
    
    return keys;
  }

  private flipBoardHorizontally(board: Board): Board {
    return board.map(row => [...row].reverse());
  }

  private createEmptyBoard(): Board {
    return Array(this.BOARD_ROWS).fill(null).map(() => 
      Array(this.BOARD_COLS).fill('Empty' as CellValue)
    );
  }

  private getLowestEmptyRow(board: Board, col: number): number {
    for (let row = this.BOARD_ROWS - 1; row >= 0; row--) {
      if (board[row][col] === 'Empty') {
        return row;
      }
    }
    return -1;
  }

  private getBoardDepth(board: Board): number {
    let depth = 0;
    for (const row of board) {
      for (const cell of row) {
        if (cell !== 'Empty') {
          depth++;
        }
      }
    }
    return depth;
  }

  // Utility methods for analysis
  getOpeningStats(): {
    totalPositions: number;
    averageDepth: number;
    mostPlayedPositions: Array<{ key: string; playCount: number }>;
  } {
    let totalDepth = 0;
    let totalEntries = 0;
    const positionPlayCounts: Array<{ key: string; playCount: number }> = [];
    
    for (const [key, entries] of this.openings.entries()) {
      const totalPlays = entries.reduce((sum, e) => sum + e.playCount, 0);
      positionPlayCounts.push({ key, playCount: totalPlays });
      
      for (const entry of entries) {
        totalDepth += entry.depth;
        totalEntries++;
      }
    }
    
    positionPlayCounts.sort((a, b) => b.playCount - a.playCount);
    
    return {
      totalPositions: this.openings.size,
      averageDepth: totalEntries > 0 ? totalDepth / totalEntries : 0,
      mostPlayedPositions: positionPlayCounts.slice(0, 10)
    };
  }

  // Prune old or rarely used entries
  async prune(minPlayCount: number = 10, maxAge: number = 365): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);
    
    for (const [key, entries] of this.openings.entries()) {
      // Filter entries
      const filteredEntries = entries.filter(entry => 
        entry.playCount >= minPlayCount && 
        entry.lastUpdated > cutoffDate
      );
      
      if (filteredEntries.length === 0) {
        this.openings.delete(key);
      } else {
        this.openings.set(key, filteredEntries);
      }
    }
  }

  // Export opening book for analysis
  async exportToCSV(filePath: string): Promise<void> {
    const headers = 'BoardKey,Column,Score,WinRate,DrawRate,LossRate,PlayCount,Depth,LastUpdated\n';
    let csvContent = headers;
    
    for (const [boardKey, entries] of this.openings.entries()) {
      for (const entry of entries) {
        csvContent += `"${boardKey}",${entry.column},${entry.score.toFixed(3)},` +
                     `${entry.winRate.toFixed(3)},${entry.drawRate.toFixed(3)},` +
                     `${entry.lossRate.toFixed(3)},${entry.playCount},` +
                     `${entry.depth},${entry.lastUpdated.toISOString()}\n`;
      }
    }
    
    await fs.writeFile(filePath, csvContent, 'utf-8');
  }
}