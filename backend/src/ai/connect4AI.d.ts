/** Valid values for each cell in the Connect 4 grid. */
export type CellValue = 'Empty' | 'Red' | 'Yellow';

/**
 * Detailed move information for ordering and pruning in search algorithms.
 */
export interface Move {
  /** Column index (0–6) where the disc is dropped. */
  col: number;
  /** Row index (0–5) where the disc lands after drop. */
  row: number;
  /** True if this move results in an immediate win for the current player. */
  isWinning: boolean;
  /** True if this move blocks an opponent's winning threat. */
  isBlocking: boolean;
  /** Number of future threats this move creates for the opponent. */
  futureThreats: number;
  /** Heuristic score: positive favors current player. */
  score: number;
}

/**
 * Configuration for AI abilities and personality traits.
 */
export interface AIAbilityConfig {
  specialAbilities: string[];
  playerPatterns: {
    favoriteColumns: number[];
    weaknessesExploited: string[];
    threatRecognitionSpeed: number;
    endgameStrength: number;
  };
  personality: {
    aggressiveness: number;
    patience: number;
  };
  level: number;
}

/**
 * Configuration for the Ultimate Connect4 AI system.
 */
export interface UltimateAIConfig {
  // AI Strategy Selection
  primaryStrategy: 'minimax' | 'mcts' | 'dqn' | 'alphazero' | 'hybrid' | 'ensemble';

  // Deep Learning Configuration
  neuralNetwork: {
    type: 'cnn' | 'resnet' | 'attention' | 'ensemble';
    enableTraining: boolean;
    trainingFrequency: number;
    batchSize: number;
    learningRate: number;
  };

  // Reinforcement Learning
  reinforcementLearning: {
    algorithm: 'dqn' | 'double_dqn' | 'dueling_dqn' | 'rainbow_dqn';
    experienceReplay: boolean;
    targetUpdateFreq: number;
    exploration: {
      strategy: 'epsilon_greedy' | 'noisy_networks' | 'ucb';
      initialValue: number;
      decayRate: number;
      finalValue: number;
    };
  };

  // MCTS Configuration
  mcts: {
    simulations: number;
    timeLimit: number;
    explorationConstant: number;
    progressiveWidening: boolean;
    parallelization: boolean;
  };

  // Advanced Features
  advanced: {
    multiAgent: boolean;
    metaLearning: boolean;
    curriculumLearning: boolean;
    populationTraining: boolean;
    explainableAI: boolean;
    realTimeAdaptation: boolean;
  };

  // Performance Settings
  performance: {
    maxThinkingTime: number;
    multiThreading: boolean;
    memoryLimit: number;
    gpuAcceleration: boolean;
  };

  // Optimizer Configuration
  optimizers: {
    adamW: {
      enabled: boolean;
      preset: 'neuralNetwork' | 'reinforcementLearning' | 'fineTuning' | 'highPerformance' | 'custom';
      config: any; // Partial<AdamWConfig>
    };
    entropyRegularizer: {
      enabled: boolean;
      preset: 'policyGradient' | 'continuousControl' | 'highExploration' | 'lowExploration' | 'custom';
      config: any; // Partial<EntropyRegularizerConfig>
    };
    learningRateScheduler: {
      enabled: boolean;
      preset: 'neuralNetwork' | 'cosineAnnealing' | 'oneCycle' | 'adaptive' | 'custom';
      config: any; // Partial<LearningRateSchedulerConfig>
    };
    integration: {
      adaptiveOptimization: boolean;
      crossOptimizerLearning: boolean;
      performanceMonitoring: boolean;
      autoTuning: boolean;
    };
  };
}

/**
 * AI decision result with comprehensive metadata.
 */
export interface AIDecision {
  move: number;
  confidence: number;
  reasoning: string;
  alternativeMoves: Array<{
    move: number;
    score: number;
    reasoning: string;
  }>;
  thinkingTime: number;
  nodesExplored: number;
  strategy: string;
  metadata: {
    neuralNetworkEvaluation?: {
      policy: number[];
      value: number;
      confidence: number;
    };
    mctsStatistics?: {
      simulations: number;
      averageDepth: number;
      bestLine: number[];
    };
    reinforcementLearning?: {
      qValues: number[];
      exploration: boolean;
      epsilonValue: number;
    };
  };
}

// ===== BASIC FUNCTIONS =====

/**
 * Compute the row index where a disc would land if dropped in a column.
 * @param board 6×7 grid of CellValue
 * @param col Column index (0–6)
 * @returns Row index (0–5) or null if the column is full.
 */
export function getDropRow(board: CellValue[][], col: number): number | null;

/**
 * Generate all legal moves sorted by priority.
 * @param board Current game board
 * @param currentPlayer 'Red' or 'Yellow' whose turn it is
 * @returns Array of Move objects sorted descending by priority
 */
export function orderedMoves(board: CellValue[][], currentPlayer: CellValue): Move[];

/**
 * List all non-full columns on the board.
 * @param board Current game board
 * @returns Array of column indices (0–6) that are not full
 */
export function legalMoves(board: CellValue[][]): number[];

/**
 * Drop a disc into the given column, returning the new board and row.
 * @param board Current game board
 * @param column Column index to drop into
 * @param disc 'Red' or 'Yellow' disc color
 * @returns Object containing the updated board and the row index where the disc landed
 */
export function tryDrop(
  board: CellValue[][],
  column: number,
  disc: CellValue
): { board: CellValue[][]; row: number };

// ===== BITBOARD FUNCTIONS =====

/**
 * Convert the board into separate red and yellow bitboards.
 * @param board Current game board
 * @returns Object with 'red' and 'yellow' bitboards as BigInt
 */
export function boardToBitboards(board: CellValue[][]): { red: bigint; yellow: bigint };

/**
 * Get a single bitboard for the specified disc color.
 * @param board Current game board
 * @param disc 'Red' or 'Yellow'
 * @returns BigInt representing the bitboard for that disc
 */
export function getBits(board: CellValue[][], disc: CellValue): bigint;

/**
 * Check a bitboard for any Connect-4 (four in a row).
 * @param bb Bitboard to check
 * @returns True if a win is detected, else false
 */
export function bitboardCheckWin(bb: bigint): boolean;

// ===== EVALUATION FUNCTIONS =====

/**
 * Evaluate a window of 4 cells for static board scoring.
 * @param cells Array of 4 CellValue entries
 * @param aiDisc 'Red' or 'Yellow' for the AI
 * @returns Numeric score contribution for this window
 */
export function evaluateWindow(cells: CellValue[], aiDisc: CellValue): number;

/**
 * Static evaluation of the entire board for a given AI disc.
 * @param board Current game board
 * @param aiDisc 'Red' or 'Yellow'
 * @param moveProbabilities Optional neural network move probabilities
 * @param lastMove Optional last move played
 * @returns Heuristic score: positive favors AI, negative favors opponent
 */
export function evaluateBoard(
  board: CellValue[][],
  aiDisc: CellValue,
  moveProbabilities?: number[],
  lastMove?: number
): number;

/**
 * Position evaluation with detailed analysis.
 * @param board Current game board
 * @param aiDisc 'Red' or 'Yellow'
 * @returns Positional score
 */
export function evaluatePosition(board: CellValue[][], aiDisc: CellValue): number;

// ===== TRANSPOSITION TABLE =====

/** Flags for transposition table entries. */
export enum EntryFlag { Exact, LowerBound, UpperBound }

/**
 * A stored entry in the transposition table.
 */
export interface TranspositionEntry {
  score: number;
  depth: number;
  column: number | null;
  flag: EntryFlag;
}

/** Generate a random 64-bit BigInt for Zobrist hashing. */
export function rand64(): bigint;

/** Compute a Zobrist hash for the given board. */
export function hashBoard(board: CellValue[][]): bigint;

/** Clear all entries from the transposition table. */
export function clearTable(): void;

/** Retrieve an entry from the transposition table by hash. */
export function getEntry(hash: bigint): TranspositionEntry | undefined;

/** Store or update an entry in the transposition table. */
export function storeEntry(hash: bigint, entry: TranspositionEntry): void;

// ===== SEARCH ALGORITHMS =====

/** Result of a minimax search node. */
export interface Node {
  score: number;
  column: number | null;
}

/**
 * Check if position is noisy and requires quiescence search.
 * @param board Current game board
 * @param aiDisc AI's disc color
 * @returns True if position has tactical complexity
 */
export function isPositionNoisy(board: CellValue[][], aiDisc: CellValue): boolean;

/**
 * Minimax search with α–β pruning, quiescence search, and transposition table.
 * @param board Current game board
 * @param depth Search depth
 * @param alpha Alpha bound
 * @param beta Beta bound
 * @param maximizingPlayer True if maximizing (AI's turn)
 * @param aiDisc 'Red' or 'Yellow' for the AI
 * @param moveProbabilities Optional neural network move probabilities
 * @param lastMove Optional last move played
 * @returns Node with best score and chosen column
 */
export function minimax(
  board: CellValue[][],
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  aiDisc: CellValue,
  moveProbabilities?: number[],
  lastMove?: number
): Node;

/**
 * Iterative deepening minimax with time control.
 * @param board Current game board
 * @param aiDisc AI's disc color
 * @param timeLimitMs Time limit in milliseconds
 * @param moveProbabilities Optional neural network move probabilities
 * @returns Best column to play
 */
export function iterativeDeepeningMinimax(
  board: CellValue[][],
  aiDisc: CellValue,
  timeLimitMs: number,
  moveProbabilities?: number[]
): number;

// ===== MCTS =====

/** Data structure for Monte Carlo Tree Search nodes. */
export interface MCTSNode {
  board: CellValue[][];
  player: CellValue;
  visits: number;
  wins: number;
  parent: MCTSNode | null;
  children: MCTSNode[];
  move: number | null;
  priorProb: number;
}

/** Deep-clone a board. */
export function cloneBoard(board: CellValue[][]): CellValue[][];

/**
 * Monte Carlo Tree Search entrypoint.
 * @param rootBoard Current game board
 * @param aiDisc 'Red' or 'Yellow'
 * @param timeMs Time budget in milliseconds
 * @param moveProbabilities Optional neural network move probabilities
 * @returns Selected column index
 */
export function mcts(
  rootBoard: CellValue[][],
  aiDisc: CellValue,
  timeMs: number,
  moveProbabilities?: number[]
): number;

// ===== THREAT DETECTION =====

/** Check if player has immediate win. */
export function hasImmediateWin(board: CellValue[][], disc: CellValue): boolean;

/** Count all opponent open-three fork threats. */
export function countOpenThree(board: CellValue[][], player: CellValue): number;

/** Detect and return the column for an opponent's open-three fork block. */
export function findOpenThreeBlock(
  board: CellValue[][],
  oppDisc: CellValue
): number | null;

/** Count two-step fork potential. */
export function countTwoStepForks(
  board: CellValue[][],
  aiDisc: CellValue
): number;

/** Block floating diagonal threats. */
export function blockFloatingOpenThreeDiagonal(
  board: CellValue[][],
  oppDisc: CellValue
): number | null;

// ===== AI MOVE SELECTION =====

/**
 * Get best AI move using multiple strategies.
 * @param board Current game board
 * @param aiDisc AI's disc color
 * @param timeMs Time budget in milliseconds
 * @param moveProbabilities Optional neural network move probabilities
 * @param abilityConfig Optional AI ability configuration
 * @returns Best column to play
 */
export function getBestAIMove(
  board: CellValue[][],
  aiDisc: CellValue,
  timeMs?: number,
  moveProbabilities?: number[],
  abilityConfig?: AIAbilityConfig
): number;

/**
 * Enhanced AI move selection with advanced features.
 * @param board Current game board
 * @param aiDisc AI's disc color
 * @param timeMs Time budget in milliseconds
 * @param moveProbabilities Optional neural network move probabilities
 * @param abilityConfig Optional AI ability configuration
 * @returns Best column to play
 */
export function getEnhancedAIMove(
  board: CellValue[][],
  aiDisc: CellValue,
  timeMs?: number,
  moveProbabilities?: number[],
  abilityConfig?: AIAbilityConfig
): number;

// ===== ULTIMATE AI CLASS =====

/**
 * Ultimate Connect Four AI - The Most Advanced AI System
 * 
 * Features multiple AI paradigms, neural networks, optimizers, and real-time adaptation.
 */
export class UltimateConnect4AI {
  constructor(config?: Partial<UltimateAIConfig>);

  /**
   * Get the best move using the configured AI strategy.
   * @param board Current game board
   * @param aiDisc AI's disc color
   * @param timeMs Time budget in milliseconds
   * @param abilityConfig Optional AI ability configuration
   * @returns Promise resolving to AI decision with metadata
   */
  getBestMove(
    board: CellValue[][],
    aiDisc: CellValue,
    timeMs?: number,
    abilityConfig?: AIAbilityConfig
  ): Promise<AIDecision>;

  /**
   * Optimize neural network training using integrated optimizers.
   * @param network Network type to optimize
   * @param trainingData Training data samples
   * @param batchSize Batch size for training
   * @returns Promise resolving to training results and optimizer metrics
   */
  optimizeNeuralNetwork(
    network: 'cnn' | 'resnet' | 'attention' | 'all',
    trainingData: Array<{
      board: CellValue[][];
      targetPolicy: number[];
      targetValue: number;
    }>,
    batchSize?: number
  ): Promise<{
    loss: number;
    optimizerMetrics: any;
  }>;

  /**
   * Optimize reinforcement learning agent training.
   * @param agent RL agent type
   * @param experienceReplay Experience replay buffer
   * @param batchSize Batch size for training
   * @returns Promise resolving to training results and optimizer metrics
   */
  optimizeRLAgent(
    agent: 'dqn' | 'double_dqn' | 'dueling_dqn' | 'rainbow_dqn',
    experienceReplay: Array<{
      state: CellValue[][];
      action: number;
      reward: number;
      nextState: CellValue[][];
      done: boolean;
    }>,
    batchSize?: number
  ): Promise<{
    loss: number;
    optimizerMetrics: any;
  }>;

  /**
   * Get comprehensive AI metrics including performance and optimizer statistics.
   * @returns Object containing strategy, performance, agents, and network information
   */
  getAIMetrics(): {
    strategy: string;
    performance: {
      gamesPlayed: number;
      winRate: number;
      averageThinkingTime: number;
      totalTrainingTime: number;
      lastUpdateTime: number;
    };
    agents: any;
    neuralNetworks: {
      type: string;
      active: string[];
    };
  };

  /**
   * Get optimizer-specific metrics.
   * @returns Optimizer metrics and integration status
   */
  getOptimizerMetrics(): {
    adamW?: any;
    entropyRegularizer?: any;
    learningRateScheduler?: any;
    integration?: any;
  };

  /**
   * Update optimizer configurations.
   * @param newConfig New optimizer configuration
   */
  updateOptimizerConfig(newConfig: Partial<UltimateAIConfig['optimizers']>): void;

  /**
   * Reset all optimizers to initial state.
   */
  resetOptimizers(): void;

  /**
   * Update AI configuration.
   * @param newConfig New configuration to merge
   */
  updateConfig(newConfig: Partial<UltimateAIConfig>): void;

  /**
   * Save AI state to storage.
   * @param basePath Base path for saving files
   * @returns Promise that resolves when save is complete
   */
  saveAI(basePath: string): Promise<void>;

  /**
   * Load AI state from storage.
   * @param basePath Base path for loading files
   * @returns Promise that resolves when load is complete
   */
  loadAI(basePath: string): Promise<void>;

  /**
   * Dispose of all AI resources.
   */
  dispose(): void;
}
