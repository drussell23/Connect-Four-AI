import { Test, TestingModule } from '@nestjs/testing';
import { AIIntegrationModule } from '../../src/ai/ai-integration.module';
import { GameAIService } from '../../src/game/game-ai.service';
import { GameService } from '../../src/game/game.service';
import { CellValue } from '../../src/ai/connect4AI';
import { EventEmitter } from 'events';

describe('AI End-to-End System Tests', () => {
  let module: TestingModule;
  let gameAIService: GameAIService;
  let gameService: GameService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AIIntegrationModule],
      providers: [
        GameAIService,
        GameService,
        {
          provide: EventEmitter,
          useValue: new EventEmitter(),
        },
      ],
    }).compile();

    gameAIService = module.get<GameAIService>(GameAIService);
    gameService = module.get<GameService>(GameService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Complete Game Simulation', () => {
    it('Should play a complete game at beginner level', async () => {
      const gameId = 'e2e-beginner-game';
      const game = gameService.createGame(gameId);
      let moveCount = 0;
      const maxMoves = 42;

      while (!game.winner && !game.isDraw && moveCount < maxMoves) {
        const currentPlayer = (moveCount % 2) + 1;
        
        if (currentPlayer === 1) {
          // Human player - play center-focused strategy
          const validMoves = [];
          for (let col = 0; col < 7; col++) {
            if (game.board[0][col] === 0) {
              validMoves.push(col);
            }
          }
          
          // Prefer center columns
          const centerMoves = validMoves.filter(col => col >= 2 && col <= 4);
          const column = centerMoves.length > 0 
            ? centerMoves[Math.floor(Math.random() * centerMoves.length)]
            : validMoves[Math.floor(Math.random() * validMoves.length)];
          
          gameService.makeMove(gameId, column, currentPlayer);
        } else {
          // AI player
          const aiMove = await gameAIService.getAIMove(game.board, 1, game.moveHistory);
          gameService.makeMove(gameId, aiMove.column, currentPlayer);
        }
        
        moveCount++;
      }

      expect(moveCount).toBeGreaterThan(7); // Game should last more than 7 moves
      expect(game.winner || game.isDraw).toBeTruthy();
      
      // At beginner level, human should have a good chance of winning
      console.log(`Beginner game result: ${game.winner ? `Player ${game.winner} wins` : 'Draw'} in ${moveCount} moves`);
    });

    it('Should play a complete game at expert level', async () => {
      const gameId = 'e2e-expert-game';
      const game = gameService.createGame(gameId);
      let moveCount = 0;
      const maxMoves = 42;
      const aiLevel = 20;

      while (!game.winner && !game.isDraw && moveCount < maxMoves) {
        const currentPlayer = (moveCount % 2) + 1;
        
        if (currentPlayer === 1) {
          // Human player - play strategically
          const aiAnalysis = await gameAIService.getAIMove(game.board, 15, game.moveHistory);
          gameService.makeMove(gameId, aiAnalysis.column, currentPlayer);
        } else {
          // Expert AI
          const aiMove = await gameAIService.getAIMove(game.board, aiLevel, game.moveHistory);
          gameService.makeMove(gameId, aiMove.column, currentPlayer);
        }
        
        moveCount++;
      }

      expect(moveCount).toBeGreaterThan(10); // Expert games should be longer
      expect(game.winner || game.isDraw).toBeTruthy();
      
      console.log(`Expert game result: ${game.winner ? `Player ${game.winner} wins` : 'Draw'} in ${moveCount} moves`);
    });
  });

  describe('AI Consistency Across Difficulty Levels', () => {
    it('Should demonstrate progressive skill improvement', async () => {
      const testBoard: number[][] = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0],
        [0, 0, 2, 1, 2, 0, 0],
      ];

      const levels = [1, 5, 10, 15, 20, 25];
      const moves = [];

      for (const level of levels) {
        const move = await gameAIService.getAIMove(testBoard, level, []);
        moves.push({
          level,
          column: move.column,
          reasoning: move.reasoning,
          confidence: move.confidence,
        });
      }

      // Higher levels should consistently block the threat
      const highLevelMoves = moves.filter(m => m.level >= 15);
      expect(highLevelMoves.every(m => m.column === 3)).toBe(true);
      
      // Lower levels might miss it sometimes
      const lowLevelMoves = moves.filter(m => m.level <= 5);
      console.log('Move decisions by level:', moves);
    });
  });

  describe('Complex Scenario Handling', () => {
    it('Should handle multiple simultaneous threats', async () => {
      const complexBoard: number[][] = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 0, 1, 0, 0],
        [0, 0, 1, 2, 2, 0, 0],
        [0, 1, 2, 2, 1, 2, 0],
      ];

      const move = await gameAIService.getAIMove(complexBoard, 20, []);
      
      expect(move.reasoning).toMatch(/threat|block|defensive/i);
      expect(move.confidence).toBeGreaterThan(0.8);
      
      // Should identify and handle the most critical threat
      console.log(`AI chose column ${move.column}: ${move.reasoning}`);
    });

    it('Should create winning opportunities', async () => {
      const opportunityBoard: number[][] = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 2, 1, 2, 0, 0],
        [0, 2, 1, 1, 2, 1, 0],
      ];

      const move = await gameAIService.getAIMove(opportunityBoard, 25, []);
      
      expect(move.reasoning).toMatch(/win|offensive|setup/i);
      
      // Ultimate AI should see winning sequences
      console.log(`AI strategy: ${move.reasoning}`);
    });
  });

  describe('Performance Under Load', () => {
    it('Should maintain responsiveness with concurrent requests', async () => {
      const board: number[][] = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0],
        [0, 0, 2, 1, 2, 0, 0],
      ];

      const startTime = Date.now();
      const concurrentRequests = 10;
      
      const promises = Array(concurrentRequests).fill(null).map((_, i) => 
        gameAIService.getAIMove(board, 15 + (i % 5), [])
      );
      
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      expect(results).toHaveLength(concurrentRequests);
      expect(results.every(r => r.column >= 0 && r.column <= 6)).toBe(true);
      expect(totalTime).toBeLessThan(2000); // Should handle all requests within 2 seconds
      
      console.log(`Processed ${concurrentRequests} requests in ${totalTime}ms`);
    });
  });

  describe('AI Learning and Adaptation', () => {
    it('Should demonstrate learning from game history', async () => {
      const gameId = 'learning-test';
      const game = gameService.createGame(gameId);
      
      // Play several moves to build history
      const moves = [
        { player: 1, column: 3 },
        { player: 2, column: 3 },
        { player: 1, column: 4 },
        { player: 2, column: 4 },
        { player: 1, column: 2 },
      ];
      
      for (const move of moves) {
        gameService.makeMove(gameId, move.column, move.player);
      }
      
      // AI should learn from the pattern
      const aiMove = await gameAIService.getAIMove(
        game.board,
        20,
        game.moveHistory
      );
      
      expect(aiMove.reasoning).toMatch(/pattern|history|learned/i);
      console.log(`AI learned from history: ${aiMove.reasoning}`);
    });
  });

  describe('Error Recovery and Robustness', () => {
    it('Should handle invalid board states gracefully', async () => {
      // Board with floating pieces (invalid)
      const invalidBoard: number[][] = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 0], // Floating piece
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0],
      ];
      
      const move = await gameAIService.getAIMove(invalidBoard, 15, []);
      
      expect(move).toBeDefined();
      expect(move.column).toBeGreaterThanOrEqual(0);
      expect(move.column).toBeLessThanOrEqual(6);
      expect(move.confidence).toBeGreaterThan(0); // Should still provide confidence
    });

    it('Should recover from system stress', async () => {
      const stressBoard: number[][] = Array(6).fill(null).map(() => 
        Array(7).fill(0)
      );
      
      // Simulate system stress with rapid requests
      const stressPromises = [];
      for (let i = 0; i < 50; i++) {
        stressPromises.push(
          gameAIService.getAIMove(stressBoard, Math.floor(Math.random() * 25) + 1, [])
            .catch(err => ({ column: 3, error: err.message }))
        );
      }
      
      const results = await Promise.all(stressPromises);
      const successfulResults = results.filter(r => !r.error);
      
      expect(successfulResults.length).toBeGreaterThan(45); // >90% success rate
      console.log(`Stress test: ${successfulResults.length}/50 successful`);
    });
  });

  describe('Full System Integration', () => {
    it('Should demonstrate all AI capabilities in a showcase game', async () => {
      const gameId = 'showcase-game';
      const game = gameService.createGame(gameId);
      const moveLog = [];
      
      // Play a game showcasing different AI capabilities
      const scenarios = [
        { moves: 5, level: 5, description: 'Opening phase - Basic AI' },
        { moves: 5, level: 15, description: 'Mid-game - Intermediate AI' },
        { moves: 5, level: 25, description: 'Complex positions - Ultimate AI' },
      ];
      
      let totalMoves = 0;
      
      for (const scenario of scenarios) {
        console.log(`\n${scenario.description}`);
        
        for (let i = 0; i < scenario.moves && !game.winner && !game.isDraw; i++) {
          const currentPlayer = (totalMoves % 2) + 1;
          
          if (currentPlayer === 1) {
            // Human simulation
            const validCols = [];
            for (let col = 0; col < 7; col++) {
              if (game.board[0][col] === 0) validCols.push(col);
            }
            const column = validCols[Math.floor(Math.random() * validCols.length)];
            gameService.makeMove(gameId, column, currentPlayer);
            moveLog.push({ player: 1, column, reasoning: 'Random human move' });
          } else {
            // AI with varying difficulty
            const aiMove = await gameAIService.getAIMove(
              game.board,
              scenario.level,
              game.moveHistory
            );
            gameService.makeMove(gameId, aiMove.column, currentPlayer);
            moveLog.push({
              player: 2,
              column: aiMove.column,
              level: scenario.level,
              reasoning: aiMove.reasoning,
              confidence: aiMove.confidence,
            });
            
            console.log(`  Move ${totalMoves + 1}: AI (L${scenario.level}) plays ${aiMove.column} - ${aiMove.reasoning}`);
          }
          
          totalMoves++;
        }
      }
      
      expect(moveLog.length).toBeGreaterThan(10);
      expect(moveLog.some(m => m.reasoning?.includes('threat'))).toBe(true);
      expect(moveLog.some(m => m.reasoning?.includes('strategic'))).toBe(true);
      
      console.log(`\nGame ended: ${game.winner ? `Player ${game.winner} wins` : 'Draw or ongoing'}`);
      console.log(`Total moves: ${totalMoves}`);
    });
  });
});