import { OpeningBook, Board, CellValue } from './opening-book';

/**
 * Integration example demonstrating how to use the OpeningBook class
 * in a Connect Four AI system.
 */

class OpeningBookIntegration {
  private openingBook: OpeningBook;

  constructor() {
    this.openingBook = new OpeningBook();
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Opening Book...');
    await this.openingBook.load();
    
    const stats = this.openingBook.getOpeningStats();
    console.log(`📚 Loaded ${stats.totalPositions} opening positions`);
    console.log(`📊 Average depth: ${stats.averageDepth.toFixed(1)} moves`);
  }

  async demonstrateBasicUsage(): Promise<void> {
    console.log('\n=== Basic Usage Demo ===');
    
    // Empty board lookup
    const emptyBoard = this.createEmptyBoard();
    const bestMove = await this.openingBook.lookup(emptyBoard);
    console.log(`Best opening move: Column ${bestMove}`);
    
    // Get detailed statistics
    const stats = await this.openingBook.lookupWithStats(emptyBoard);
    if (stats) {
      console.log('\nTop 3 opening moves:');
      stats.slice(0, 3).forEach((entry, idx) => {
        console.log(`${idx + 1}. Column ${entry.column}: Score=${entry.score.toFixed(3)}, ` +
                   `Win=${(entry.winRate * 100).toFixed(1)}%, ` +
                   `Draw=${(entry.drawRate * 100).toFixed(1)}%, ` +
                   `Loss=${(entry.lossRate * 100).toFixed(1)}%`);
      });
    }
  }

  async demonstrateGameIntegration(): Promise<void> {
    console.log('\n=== Game Integration Demo ===');
    
    // Simulate a game using opening book
    const board = this.createEmptyBoard();
    const moveHistory: Array<{ player: CellValue; column: number }> = [];
    
    // Play first few moves using opening book
    for (let moveNum = 0; moveNum < 6; moveNum++) {
      const currentPlayer: CellValue = moveNum % 2 === 0 ? 'Red' : 'Yellow';
      
      // Check opening book
      const suggestedMove = await this.openingBook.lookup(board);
      
      if (suggestedMove !== null) {
        console.log(`Move ${moveNum + 1}: Opening book suggests column ${suggestedMove} for ${currentPlayer}`);
        
        // Make the move
        const row = this.getLowestEmptyRow(board, suggestedMove);
        if (row !== -1) {
          board[row][suggestedMove] = currentPlayer;
          moveHistory.push({ player: currentPlayer, column: suggestedMove });
        }
      } else {
        console.log(`Move ${moveNum + 1}: No opening book entry found, switching to regular AI`);
        break;
      }
      
      this.printBoard(board);
    }
  }

  async demonstrateLearning(): Promise<void> {
    console.log('\n=== Learning Demo ===');
    
    // Simulate learning from game results
    const testBoard = this.createEmptyBoard();
    testBoard[5][3] = 'Red';
    testBoard[5][2] = 'Yellow';
    
    console.log('Before learning:');
    let stats = await this.openingBook.lookupWithStats(testBoard);
    if (!stats) {
      console.log('No data for this position yet');
    }
    
    // Simulate some game results
    console.log('\nSimulating 10 games from this position...');
    await this.openingBook.updateEntry(testBoard, 4, 'win');
    await this.openingBook.updateEntry(testBoard, 4, 'win');
    await this.openingBook.updateEntry(testBoard, 4, 'draw');
    await this.openingBook.updateEntry(testBoard, 3, 'loss');
    await this.openingBook.updateEntry(testBoard, 3, 'draw');
    await this.openingBook.updateEntry(testBoard, 2, 'win');
    await this.openingBook.updateEntry(testBoard, 2, 'loss');
    await this.openingBook.updateEntry(testBoard, 1, 'loss');
    await this.openingBook.updateEntry(testBoard, 1, 'loss');
    await this.openingBook.updateEntry(testBoard, 1, 'loss');
    
    console.log('\nAfter learning:');
    stats = await this.openingBook.lookupWithStats(testBoard);
    if (stats) {
      stats.forEach(entry => {
        console.log(`Column ${entry.column}: Score=${entry.score.toFixed(3)}, ` +
                   `Games=${entry.playCount}, ` +
                   `Win=${(entry.winRate * 100).toFixed(1)}%`);
      });
    }
    
    const bestMove = await this.openingBook.lookup(testBoard);
    console.log(`\nBest move after learning: Column ${bestMove}`);
  }

  async demonstratePersistence(): Promise<void> {
    console.log('\n=== Persistence Demo ===');
    
    // Save current opening book
    console.log('Saving opening book...');
    await this.openingBook.save();
    console.log('Opening book saved successfully');
    
    // Export to CSV for analysis
    const csvPath = './opening-book-export.csv';
    console.log(`\nExporting to CSV: ${csvPath}`);
    await this.openingBook.exportToCSV(csvPath);
    console.log('CSV export completed');
    
    // Demonstrate pruning
    console.log('\nPruning rarely used entries...');
    const statsBefore = this.openingBook.getOpeningStats();
    await this.openingBook.prune(5, 30); // Keep entries with 5+ plays from last 30 days
    const statsAfter = this.openingBook.getOpeningStats();
    console.log(`Pruned ${statsBefore.totalPositions - statsAfter.totalPositions} positions`);
  }

  async demonstrateSymmetry(): Promise<void> {
    console.log('\n=== Symmetry Demo ===');
    
    // Create mirrored positions
    const boardLeft = this.createEmptyBoard();
    boardLeft[5][0] = 'Red'; // Left edge
    
    const boardRight = this.createEmptyBoard();
    boardRight[5][6] = 'Red'; // Right edge
    
    console.log('Left edge opening:');
    this.printBoard(boardLeft);
    const moveLeft = await this.openingBook.lookup(boardLeft);
    console.log(`Suggested response: Column ${moveLeft}`);
    
    console.log('\nRight edge opening (symmetric):');
    this.printBoard(boardRight);
    const moveRight = await this.openingBook.lookup(boardRight);
    console.log(`Suggested response: Column ${moveRight}`);
    
    console.log('\nBoth positions suggest the same strategy due to symmetry handling');
  }

  // Helper methods
  private createEmptyBoard(): Board {
    return Array(6).fill(null).map(() => Array(7).fill('Empty' as CellValue));
  }

  private getLowestEmptyRow(board: Board, col: number): number {
    for (let row = 5; row >= 0; row--) {
      if (board[row][col] === 'Empty') {
        return row;
      }
    }
    return -1;
  }

  private printBoard(board: Board): void {
    console.log('\nCurrent board:');
    console.log('  0 1 2 3 4 5 6');
    for (let row = 0; row < 6; row++) {
      let line = `${row} `;
      for (let col = 0; col < 7; col++) {
        const cell = board[row][col];
        if (cell === 'Empty') line += '. ';
        else if (cell === 'Red') line += 'R ';
        else line += 'Y ';
      }
      console.log(line);
    }
  }
}

// Run the demonstration
async function runDemo() {
  const demo = new OpeningBookIntegration();
  
  try {
    await demo.initialize();
    await demo.demonstrateBasicUsage();
    await demo.demonstrateGameIntegration();
    await demo.demonstrateLearning();
    await demo.demonstrateSymmetry();
    await demo.demonstratePersistence();
    
    console.log('\n✅ Opening Book demonstration completed successfully!');
  } catch (error) {
    console.error('❌ Error during demonstration:', error);
  }
}

// Uncomment to run the demo
// runDemo();

export { OpeningBookIntegration };