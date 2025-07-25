import { Test, TestingModule } from '@nestjs/testing';
import { ReinforcementLearningService } from '../../src/ai/learning/reinforcement-learning.service';
import { EnhancedRLService } from '../../src/ai/learning/enhanced-rl.service';
import { CellValue } from '../../src/ai/connect4AI';

// Mock TensorFlow types
interface MockTensor {
  shape: number[];
  dtype: string;
  arraySync(): number[][];
  dispose(): void;
}

describe('Reinforcement Learning Integration Tests', () => {
  let rlService: ReinforcementLearningService;
  let enhancedRLService: EnhancedRLService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReinforcementLearningService,
        EnhancedRLService,
      ],
    }).compile();

    rlService = module.get<ReinforcementLearningService>(ReinforcementLearningService);
    enhancedRLService = module.get<EnhancedRLService>(EnhancedRLService);
  });

  describe('Basic RL Service', () => {
    it('Should initialize with default configuration', () => {
      expect(rlService).toBeDefined();
      const config = rlService.getConfig();
      
      expect(config).toBeDefined();
      expect(config.algorithm).toBeDefined();
      expect(config.learningRate).toBeGreaterThan(0);
      expect(config.discountFactor).toBeGreaterThan(0);
      expect(config.discountFactor).toBeLessThanOrEqual(1);
    });

    it('Should process board states for learning', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const stateVector = await rlService.preprocessState(board);
      
      expect(stateVector).toBeDefined();
      expect(stateVector.length).toBe(42); // 6x7 board flattened
      expect(stateVector.filter(v => v !== 0).length).toBe(4); // 4 pieces on board
    });

    it('Should generate action predictions', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const predictions = await rlService.predictAction(board, 'Yellow');
      
      expect(predictions).toBeDefined();
      expect(predictions.length).toBe(7); // One prediction per column
      expect(Math.max(...predictions)).toBeGreaterThan(Math.min(...predictions));
      
      // Column 3 should have high value (blocks threat)
      expect(predictions[3]).toBeGreaterThan(predictions[0]);
    });

    it('Should update model with experience', async () => {
      const experience = {
        state: Array(42).fill(0),
        action: 3,
        reward: 10,
        nextState: Array(42).fill(0),
        done: false,
      };

      const loss = await rlService.updateModel([experience]);
      
      expect(loss).toBeDefined();
      expect(loss).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Enhanced RL Service', () => {
    it('Should support multiple RL algorithms', () => {
      const algorithms = enhancedRLService.getAvailableAlgorithms();
      
      expect(algorithms).toContain('DQN');
      expect(algorithms).toContain('PPO');
      expect(algorithms).toContain('A3C');
      expect(algorithms).toContain('AlphaZero');
      expect(algorithms.length).toBeGreaterThan(10);
    });

    it('Should select algorithm based on game state', async () => {
      // Early game
      const earlyBoard: CellValue[][] = Array(6).fill(null).map(() => 
        Array(7).fill('Empty' as CellValue)
      );
      earlyBoard[5][3] = 'Red';

      const earlyAlgorithm = await enhancedRLService.selectOptimalAlgorithm(
        earlyBoard,
        'Yellow',
        { phase: 'opening', moveCount: 1 }
      );
      
      expect(['PPO', 'AlphaZero', 'MCTS']).toContain(earlyAlgorithm);

      // End game
      const endBoard: CellValue[][] = Array(6).fill(null).map((_, row) => 
        Array(7).fill(null).map((_, col) => {
          if (row > 2) return (row + col) % 2 === 0 ? 'Red' : 'Yellow';
          return 'Empty';
        }) as CellValue[]
      );

      const endAlgorithm = await enhancedRLService.selectOptimalAlgorithm(
        endBoard,
        'Yellow',
        { phase: 'endgame', moveCount: 30 }
      );
      
      expect(['DQN', 'DoubleDQN', 'RainbowDQN']).toContain(endAlgorithm);
    });

    it('Should provide enhanced move predictions with confidence', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const prediction = await enhancedRLService.getEnhancedPrediction(
        board,
        'Yellow',
        { includeConfidence: true, topK: 3 }
      );
      
      expect(prediction).toBeDefined();
      expect(prediction.topMoves).toHaveLength(3);
      expect(prediction.topMoves[0].confidence).toBeGreaterThan(0.5);
      expect(prediction.topMoves[0].column).toBe(3); // Block vertical threat
      expect(prediction.explanation).toContain('block');
    });
  });

  describe('Self-Play and Learning', () => {
    it('Should execute self-play games for training', async () => {
      const results = await enhancedRLService.runSelfPlay({
        numGames: 5,
        algorithm: 'DQN',
        difficulty: 15,
      });

      expect(results).toBeDefined();
      expect(results.gamesPlayed).toBe(5);
      expect(results.averageMoves).toBeGreaterThan(7); // Games should last more than 7 moves
      expect(results.winRates).toBeDefined();
      expect(results.winRates.player1 + results.winRates.player2 + results.winRates.draws).toBeCloseTo(1.0);
    });

    it('Should improve performance through experience replay', async () => {
      // Generate training experiences
      const experiences = [];
      for (let i = 0; i < 100; i++) {
        experiences.push({
          state: Array(42).fill(0).map(() => Math.random() < 0.3 ? 1 : 0),
          action: Math.floor(Math.random() * 7),
          reward: Math.random() * 2 - 1,
          nextState: Array(42).fill(0).map(() => Math.random() < 0.3 ? 1 : 0),
          done: Math.random() < 0.1,
        });
      }

      const trainingResults = await enhancedRLService.trainWithExperienceReplay(
        experiences,
        { batchSize: 32, epochs: 5 }
      );

      expect(trainingResults).toBeDefined();
      expect(trainingResults.finalLoss).toBeLessThan(trainingResults.initialLoss);
      expect(trainingResults.improvement).toBeGreaterThan(0);
    });
  });

  describe('Multi-Agent and Advanced Features', () => {
    it('Should support opponent modeling', async () => {
      const opponentHistory = [
        { board: Array(6).fill(null).map(() => Array(7).fill('Empty')), move: 3 },
        { board: Array(6).fill(null).map(() => Array(7).fill('Empty')), move: 3 },
        { board: Array(6).fill(null).map(() => Array(7).fill('Empty')), move: 2 },
      ];

      const opponentModel = await enhancedRLService.buildOpponentModel(
        opponentHistory,
        { modelType: 'pattern-based' }
      );

      expect(opponentModel).toBeDefined();
      expect(opponentModel.predictedStyle).toBeDefined();
      expect(['aggressive', 'defensive', 'balanced']).toContain(opponentModel.predictedStyle);
      expect(opponentModel.preferredColumns).toContain(3);
    });

    it('Should adapt strategy based on opponent behavior', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Red', 'Yellow', 'Red', 'Empty', 'Empty'],
        ['Empty', 'Red', 'Red', 'Yellow', 'Yellow', 'Red', 'Empty'],
      ];

      const adaptiveMove = await enhancedRLService.getAdaptiveMove(
        board,
        'Yellow',
        {
          opponentStyle: 'aggressive',
          gamePhase: 'middle',
          riskTolerance: 0.3,
        }
      );

      expect(adaptiveMove).toBeDefined();
      expect(adaptiveMove.reasoning).toContain('defensive');
      expect(adaptiveMove.alternativeMoves).toHaveLength(2);
    });
  });

  describe('Performance and Optimization', () => {
    it('Should optimize model inference for speed', async () => {
      const board: CellValue[][] = Array(6).fill(null).map(() => 
        Array(7).fill('Empty' as CellValue)
      );

      // Warm up
      await enhancedRLService.getEnhancedPrediction(board, 'Yellow');

      // Measure optimized inference
      const start = Date.now();
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        await enhancedRLService.getEnhancedPrediction(board, 'Yellow', {
          fastMode: true,
        });
      }
      
      const avgTime = (Date.now() - start) / iterations;
      expect(avgTime).toBeLessThan(50); // Should be fast
    });

    it('Should handle model ensemble predictions', async () => {
      const board: CellValue[][] = [
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Empty', 'Red', 'Empty', 'Empty', 'Empty'],
        ['Empty', 'Empty', 'Yellow', 'Red', 'Yellow', 'Empty', 'Empty'],
      ];

      const ensemblePrediction = await enhancedRLService.getEnsemblePrediction(
        board,
        'Yellow',
        {
          models: ['DQN', 'PPO', 'A3C'],
          aggregation: 'weighted',
        }
      );

      expect(ensemblePrediction).toBeDefined();
      expect(ensemblePrediction.consensus).toBeDefined();
      expect(ensemblePrediction.modelVotes).toHaveLength(3);
      expect(ensemblePrediction.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Learning Progress Tracking', () => {
    it('Should track learning metrics over time', async () => {
      const metrics = await enhancedRLService.getLearningMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.totalGamesPlayed).toBeGreaterThanOrEqual(0);
      expect(metrics.winRateProgression).toBeDefined();
      expect(metrics.averageReward).toBeDefined();
      expect(metrics.explorationRate).toBeGreaterThan(0);
      expect(metrics.explorationRate).toBeLessThanOrEqual(1);
    });

    it('Should provide learning curve analysis', async () => {
      const analysis = await enhancedRLService.analyzeLearningCurve({
        windowSize: 100,
        smoothing: 0.9,
      });

      expect(analysis).toBeDefined();
      expect(analysis.isImproving).toBeDefined();
      expect(analysis.plateauDetected).toBeDefined();
      expect(analysis.recommendedActions).toBeDefined();
      
      if (analysis.plateauDetected) {
        expect(analysis.recommendedActions).toContain('increase_exploration');
      }
    });
  });
});