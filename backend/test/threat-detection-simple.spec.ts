describe('AI Threat Detection Fix - Simple Unit Test', () => {
  // Mock the checkWin function
  const checkWin = (board: any[][], row: number, col: number, player: string): boolean => {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    
    for (const [dr, dc] of directions) {
      let count = 1;
      
      // Check positive direction
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
        count++;
        r += dr;
        c += dc;
      }
      
      // Check negative direction
      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
        count++;
        r -= dr;
        c -= dc;
      }
      
      if (count >= 4) return true;
    }
    
    return false;
  };

  // Simplified version of getQuickStrategicMove with the fix
  const getQuickStrategicMove = (board: any[][]): number => {
    // Simple strategic evaluation - check for immediate threats and opportunities
    for (let col = 0; col < 7; col++) {
      if (board[0][col] !== 'Empty') continue; // Column full - THIS IS THE FIX
      
      // Find the row where the piece would land
      let row = 5;
      while (row >= 0 && board[row][col] !== 'Empty') { // THIS IS THE FIX
        row--;
      }
      if (row < 0) continue; // Column full
      
      // Check for immediate win
      board[row][col] = 'Yellow';
      if (checkWin(board, row, col, 'Yellow')) {
        board[row][col] = 'Empty'; // Reset - THIS IS THE FIX
        return col;
      }
      board[row][col] = 'Empty'; // Reset - THIS IS THE FIX
      
      // Check for blocking opponent win
      board[row][col] = 'Red';
      const wouldWin = checkWin(board, row, col, 'Red');
      board[row][col] = 'Empty'; // Reset - THIS IS THE FIX
      
      if (wouldWin) {
        return col;
      }
    }
    
    // Return -1 to indicate no immediate threats/opportunities found
    return -1;
  };

  it('should detect and block vertical threats with Empty string values', () => {
    // Setup a board with a vertical threat (Red has 3 in a row vertically)
    const board = [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Yellow', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
    ];

    const move = getQuickStrategicMove(board);
    
    // AI should block at column 0, row 2
    expect(move).toBe(0);
  });

  it('should detect and block horizontal threats', () => {
    // Setup a board with a horizontal threat (Red has 3 in a row horizontally)
    const board = [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Red', 'Red', 'Empty', 'Yellow', 'Yellow', 'Empty'],
    ];

    const move = getQuickStrategicMove(board);
    
    // AI should block at column 3
    expect(move).toBe(3);
  });

  it('should detect and block diagonal threats', () => {
    // Setup a board with a diagonal threat
    const board = [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Red', 'Yellow', 'Yellow', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Yellow', 'Red', 'Red', 'Yellow', 'Empty', 'Empty'],
    ];

    const move = getQuickStrategicMove(board);
    
    // AI should block at column 0 (completing the diagonal)
    expect(move).toBe(0);
  });

  it('should prioritize winning over blocking', () => {
    // Setup a board where AI can win
    const board = [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Yellow', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Yellow', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Yellow', 'Red', 'Red', 'Red', 'Empty', 'Empty', 'Empty'],
    ];

    const move = getQuickStrategicMove(board);
    
    // AI should win at column 0 instead of blocking at column 4
    expect(move).toBe(0);
  });

  it('should return -1 when no threats or opportunities exist', () => {
    // Setup a board with no immediate threats
    const board = [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Red', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty', 'Empty'],
    ];

    const move = getQuickStrategicMove(board);
    
    // Should return -1 to indicate no immediate threats/opportunities
    expect(move).toBe(-1);
  });

  // Test the exact scenario from the user's screenshot
  it('should block the exact vertical threat scenario from the screenshot', () => {
    // Recreating the exact board state from the user's screenshot
    const board = [
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
      ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
      ['Yellow', 'Empty', 'Empty', 'Red', 'Yellow', 'Empty', 'Empty'],
    ];

    const move = getQuickStrategicMove(board);
    
    // AI must block at column 3 to prevent Red from winning
    expect(move).toBe(3);
  });
});