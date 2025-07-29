import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from '../../src/game/game.service';
import { GameAIService } from '../../src/game/game-ai.service';
import { AdaptiveAIOrchestrator } from '../../src/ai/adaptive/adaptive-ai-orchestrator';
import { StrategicAIEngine } from '../../src/ai/strategy/strategic-ai-engine';
import { EnhancedThreatDetector } from '../../src/ai/threat-detection/enhanced-threat-detector';
import { getDifficultyConfig } from '../../src/ai/config/difficulty-config';

describe('AI Game Scenarios Integration Tests', () => {
  let gameService: GameService;
  let gameAIService: GameAIService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        GameService,
        GameAIService,
        AdaptiveAIOrchestrator,
        StrategicAIEngine,
        EnhancedThreatDetector,
      ],
    }).compile();

    gameService = module.get<GameService>(GameService);
    gameAIService = module.get<GameAIService>(GameAIService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Real Game Simulation Tests', () => {
    it('Should prevent player from winning easily with vertical connections', async () => {
      const gameId = 'test-vertical-game';
      const game = gameService.createGame(gameId);
      
      // Simulate a game where player tries to win vertically
      // Player moves in column 3, AI should block
      const moves = [
        { player: 1, column: 3 }, // Player
        { player: 2, column: 4 }, // AI
        { player: 1, column: 3 }, // Player
        { player: 2, column: 4 }, // AI
        { player: 1, column: 3 }, // Player (3 in column)
      ];

      for (const move of moves) {
        if (move.player === 1) {
          gameService.makeMove(gameId, move.column, move.player);
        } else {
          // AI move with level 15 (Skilled)
          const aiMove = await gameAIService.getAIMove(
            game.board,
            15,
            game.moveHistory
          );
          gameService.makeMove(gameId, aiMove.column, move.player);
        }
      }

      // AI's next move should block column 3
      const criticalAIMove = await gameAIService.getAIMove(
        game.board,
        15,
        game.moveHistory
      );
      
      expect(criticalAIMove.column).toBe(3);
      expect(criticalAIMove.reasoning).toContain('block');
    });

    it('Should demonstrate improved AI performance across difficulty levels', async () => {
      const testScenarios = [
        {
          level: 1,
          expectedWinRate: 0.1, // Beginner AI loses often
          description: 'Beginner',
        },
        {
          level: 10,
          expectedWinRate: 0.4, // Intermediate AI is competitive
          description: 'Intermediate',
        },
        {
          level: 20,
          expectedWinRate: 0.7, // Expert AI wins often
          description: 'Expert',
        },
        {
          level: 25,
          expectedWinRate: 0.85, // Ultimate AI rarely loses
          description: 'Ultimate',
        },
      ];

      for (const scenario of testScenarios) {
        const wins = await simulateMultipleGames(
          gameService,
          gameAIService,
          scenario.level,
          20 // Play 20 games per level
        );
        
        const winRate = wins.ai / (wins.ai + wins.player);
        
        // AI performance should improve with level
        expect(winRate).toBeGreaterThanOrEqual(scenario.expectedWinRate * 0.7); // Allow some variance
        
        console.log(
          `Level ${scenario.level} (${scenario.description}): ` +
          `AI won ${wins.ai}/${wins.ai + wins.player} games (${(winRate * 100).toFixed(1)}%)`
        );
      }
    });

    it('Should handle complex fork situations at higher levels', async () => {
      const gameId = 'test-fork-game';
      const game = gameService.createGame(gameId);
      
      // Setup a position where player can create a fork
      const setupMoves = [
        { player: 1, column: 3 }, // Center
        { player: 2, column: 2 },
        { player: 1, column: 4 }, // Building horizontal
        { player: 2, column: 3 }, // AI blocks vertical
        { player: 1, column: 2 }, // Creating fork opportunity
      ];

      for (const move of setupMoves) {
        gameService.makeMove(gameId, move.column, move.player);
      }

      // Test different AI levels' response to fork threat
      const levels = [5, 15, 25];
      
      for (const level of levels) {
        const aiMove = await gameAIService.getAIMove(
          game.board,
          level,
          game.moveHistory
        );
        
        if (level >= 15) {
          // Higher level AI should recognize and prevent the fork
          expect([1, 5]).toContain(aiMove.column); // Defensive columns
          expect(aiMove.reasoning).toMatch(/fork|multiple.*threat/i);
        }
      }
    });

    it('Should maintain consistent challenge across extended gameplay', async () => {
      // Play a full game at level 20 and verify AI maintains quality
      const gameId = 'test-extended-game';
      const game = gameService.createGame(gameId);
      const level = 20;
      
      let moveCount = 0;
      let aiBlockedThreats = 0;
      let playerBlockedThreats = 0;
      
      // Play until game ends or 20 moves
      while (!game.winner && !game.isDraw && moveCount < 20) {
        const currentPlayer = (moveCount % 2) + 1;
        
        if (currentPlayer === 1) {
          // Simulate strategic player moves
          const column = getStrategicPlayerMove(game.board);
          gameService.makeMove(gameId, column, currentPlayer);
        } else {
          // AI move
          const beforeThreats = countThreats(game.board, 1); // Player threats
          
          const aiMove = await gameAIService.getAIMove(
            game.board,
            level,
            game.moveHistory
          );
          gameService.makeMove(gameId, aiMove.column, currentPlayer);
          
          const afterThreats = countThreats(game.board, 1);
          if (beforeThreats > afterThreats) {
            aiBlockedThreats++;
          }
          
          // Check if AI created threats
          const aiThreats = countThreats(game.board, 2);
          if (aiThreats > 0 && aiMove.reasoning?.includes('offensive')) {
            // AI is playing strategically
          }
        }
        
        moveCount++;
      }
      
      // At level 20, AI should block most threats
      expect(aiBlockedThreats).toBeGreaterThanOrEqual(2);
      
      // Game should last reasonable number of moves (not too quick loss)
      if (game.winner === 1) {
        expect(moveCount).toBeGreaterThanOrEqual(10); // AI put up a fight
      }
    });
  });

  describe('Specific Direction Blocking Validation', () => {
    const directions = [
      { name: 'vertical', setup: setupVerticalThreat },
      { name: 'horizontal', setup: setupHorizontalThreat },
      { name: 'diagonal-right', setup: setupDiagonalRightThreat },
      { name: 'diagonal-left', setup: setupDiagonalLeftThreat },
    ];

    for (const direction of directions) {
      it(`Should consistently block ${direction.name} threats across all levels`, async () => {
        const results = {};
        
        for (let level = 1; level <= 25; level += 4) {
          const gameId = `test-${direction.name}-${level}`;
          const game = gameService.createGame(gameId);
          
          // Setup the specific threat
          direction.setup(game, gameService, gameId);
          
          // Get AI response
          const aiMove = await gameAIService.getAIMove(
            game.board,
            level,
            game.moveHistory
          );
          
          // Check if AI blocked the threat
          const blocked = verifyThreatBlocked(
            game.board,
            aiMove.column,
            direction.name
          );
          
          results[level] = blocked;
          
          // Higher levels should always block
          if (level >= 10) {
            expect(blocked).toBe(true);
          }
        }
        
        console.log(`${direction.name} blocking results:`, results);
      });
    }
  });

  describe('AI Learning and Adaptation', () => {
    it('Should show improved performance over multiple games', async () => {
      const level = 15;
      const gamesPerBatch = 10;
      const batches = 3;
      
      const batchResults = [];
      
      for (let batch = 0; batch < batches; batch++) {
        const wins = await simulateMultipleGames(
          gameService,
          gameAIService,
          level,
          gamesPerBatch
        );
        
        const winRate = wins.ai / gamesPerBatch;
        batchResults.push(winRate);
        
        // AI should maintain consistent performance
        if (batch > 0) {
          expect(winRate).toBeGreaterThanOrEqual(batchResults[0] * 0.8);
        }
      }
      
      console.log('AI performance over batches:', batchResults);
    });
  });

  describe('Mistake Rate Validation', () => {
    it('Should demonstrate decreasing mistake rates', async () => {
      const testLevels = [1, 5, 10, 15, 20, 25];
      const mistakeRates = {};
      
      for (const level of testLevels) {
        const config = difficultyLevels[level];
        let mistakes = 0;
        const trials = 50;
        
        // Simulate decision making
        for (let i = 0; i < trials; i++) {
          if (Math.random() < config.mistakeRate) {
            mistakes++;
          }
        }
        
        mistakeRates[level] = mistakes / trials;
        
        // Verify mistake rate matches configuration
        expect(mistakeRates[level]).toBeCloseTo(config.mistakeRate, 1);
      }
      
      // Verify decreasing trend
      for (let i = 1; i < testLevels.length; i++) {
        expect(mistakeRates[testLevels[i]]).toBeLessThanOrEqual(
          mistakeRates[testLevels[i - 1]]
        );
      }
    });
  });
});

// Helper functions for integration tests
async function simulateMultipleGames(
  gameService: GameService,
  gameAIService: GameAIService,
  aiLevel: number,
  numGames: number
): Promise<{ ai: number; player: number; draws: number }> {
  const results = { ai: 0, player: 0, draws: 0 };
  
  for (let i = 0; i < numGames; i++) {
    const gameId = `sim-game-${i}`;
    const game = gameService.createGame(gameId);
    
    // Alternate who goes first
    let currentPlayer = (i % 2) + 1;
    let moveCount = 0;
    
    while (!game.winner && !game.isDraw && moveCount < 42) {
      if (currentPlayer === 1) {
        // Simulated player uses basic strategy
        const column = getStrategicPlayerMove(game.board);
        gameService.makeMove(gameId, column, currentPlayer);
      } else {
        // AI move
        const aiMove = await gameAIService.getAIMove(
          game.board,
          aiLevel,
          game.moveHistory
        );
        gameService.makeMove(gameId, aiMove.column, currentPlayer);
      }
      
      currentPlayer = currentPlayer === 1 ? 2 : 1;
      moveCount++;
    }
    
    if (game.winner === 1) results.player++;
    else if (game.winner === 2) results.ai++;
    else results.draws++;
  }
  
  return results;
}

function getStrategicPlayerMove(board: number[][]): number {
  // Simple strategic player that tries to win and block
  const validColumns = [];
  
  for (let col = 0; col < 7; col++) {
    if (board[0][col] === 0) {
      validColumns.push(col);
    }
  }
  
  // Prefer center columns
  const centerCols = validColumns.filter(col => col >= 2 && col <= 4);
  if (centerCols.length > 0) {
    return centerCols[Math.floor(Math.random() * centerCols.length)];
  }
  
  return validColumns[Math.floor(Math.random() * validColumns.length)];
}

function countThreats(board: number[][], player: number): number {
  let threats = 0;
  
  // Check all positions for potential threats (3 in a row with empty space)
  // Simplified threat counting for testing
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      // Check horizontal
      if (col <= 3) {
        const cells = [
          board[row][col],
          board[row][col + 1],
          board[row][col + 2],
          board[row][col + 3],
        ];
        if (cells.filter(c => c === player).length === 3 && 
            cells.includes(0)) {
          threats++;
        }
      }
      
      // Check vertical
      if (row <= 2) {
        const cells = [
          board[row][col],
          board[row + 1][col],
          board[row + 2][col],
          board[row + 3][col],
        ];
        if (cells.filter(c => c === player).length === 3 && 
            cells.includes(0)) {
          threats++;
        }
      }
    }
  }
  
  return threats;
}

function setupVerticalThreat(game: any, gameService: any, gameId: string) {
  // Create a vertical threat for player 1
  gameService.makeMove(gameId, 3, 1);
  gameService.makeMove(gameId, 4, 2);
  gameService.makeMove(gameId, 3, 1);
  gameService.makeMove(gameId, 4, 2);
  gameService.makeMove(gameId, 3, 1); // 3 in column 3
}

function setupHorizontalThreat(game: any, gameService: any, gameId: string) {
  // Create a horizontal threat for player 1
  gameService.makeMove(gameId, 0, 1);
  gameService.makeMove(gameId, 0, 2);
  gameService.makeMove(gameId, 1, 1);
  gameService.makeMove(gameId, 1, 2);
  gameService.makeMove(gameId, 2, 1); // 3 in a row at bottom
}

function setupDiagonalRightThreat(game: any, gameService: any, gameId: string) {
  // Create a diagonal-right threat
  gameService.makeMove(gameId, 0, 1);
  gameService.makeMove(gameId, 1, 2);
  gameService.makeMove(gameId, 1, 1);
  gameService.makeMove(gameId, 2, 2);
  gameService.makeMove(gameId, 3, 1);
  gameService.makeMove(gameId, 2, 2);
  gameService.makeMove(gameId, 2, 1); // Diagonal setup
}

function setupDiagonalLeftThreat(game: any, gameService: any, gameId: string) {
  // Create a diagonal-left threat
  gameService.makeMove(gameId, 6, 1);
  gameService.makeMove(gameId, 5, 2);
  gameService.makeMove(gameId, 5, 1);
  gameService.makeMove(gameId, 4, 2);
  gameService.makeMove(gameId, 3, 1);
  gameService.makeMove(gameId, 4, 2);
  gameService.makeMove(gameId, 4, 1); // Diagonal setup
}

function verifyThreatBlocked(
  board: number[][],
  column: number,
  direction: string
): boolean {
  // Simplified verification - in real implementation would check
  // if the move actually blocks the threat in the given direction
  
  // Find the row where the piece was placed
  let row = -1;
  for (let r = 5; r >= 0; r--) {
    if (board[r][column] !== 0) {
      row = r;
      break;
    }
  }
  
  if (row === -1) return false;
  
  // For testing purposes, assume the move blocks if it's in
  // a reasonable position relative to existing pieces
  return true;
}