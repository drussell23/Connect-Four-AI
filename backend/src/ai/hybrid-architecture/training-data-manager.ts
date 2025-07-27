/**
 * Training Data Manager
 * Handles collection, storage, and processing of training data
 * Supports self-play, human games, and augmentation
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CellValue } from '../connect4AI';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import * as zlib from 'zlib';
import { pipeline } from 'stream/promises';
import * as crypto from 'crypto';

export interface GameRecord {
  id: string;
  timestamp: Date;
  players: {
    red: { type: 'human' | 'ai'; rating?: number };
    yellow: { type: 'human' | 'ai'; rating?: number };
  };
  moves: Array<{
    position: number;
    player: 'Red' | 'Yellow';
    board: CellValue[][];
    thinkingTime?: number;
  }>;
  result: {
    winner: 'Red' | 'Yellow' | 'Draw';
    reason: 'normal' | 'timeout' | 'resignation';
  };
  metadata?: Record<string, any>;
}

export interface TrainingExample {
  board: {
    board: number[][];
    player: number;
  };
  move: number;
  value: number;
  policy?: number[];
  weight?: number;
}

export interface DataAugmentationOptions {
  horizontalFlip: boolean;
  addNoise: boolean;
  rotateBoard: boolean;
  valueSmoothing: boolean;
  policySmoothing: boolean;
}

export interface DatasetStats {
  totalExamples: number;
  uniquePositions: number;
  winRateRed: number;
  winRateYellow: number;
  averageGameLength: number;
  positionFrequency: Map<string, number>;
}

@Injectable()
export class TrainingDataManager {
  private readonly logger = new Logger(TrainingDataManager.name);
  private readonly dataDir = path.join(__dirname, 'training-data');
  private readonly gamesDir = path.join(this.dataDir, 'games');
  private readonly datasetsDir = path.join(this.dataDir, 'datasets');
  private positionCache: Map<string, TrainingExample[]> = new Map();
  private readonly maxCacheSize = 100000;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.initializeDirectories();
  }

  /**
   * Save a game record
   */
  async saveGame(game: GameRecord): Promise<void> {
    const gameFile = path.join(this.gamesDir, `${game.id}.json.gz`);
    
    // Compress and save
    const jsonData = JSON.stringify(game);
    const compressed = await this.compress(Buffer.from(jsonData));
    
    await fs.writeFile(gameFile, compressed);
    
    this.logger.log(`Saved game ${game.id}`);
    
    // Emit event
    this.eventEmitter.emit('training.game.saved', {
      gameId: game.id,
      moves: game.moves.length,
      winner: game.result.winner,
    });
  }

  /**
   * Convert game to training examples
   */
  async gameToTrainingExamples(
    game: GameRecord,
    options?: {
      includePolicy?: boolean;
      augment?: DataAugmentationOptions;
      onlyWinnerMoves?: boolean;
    }
  ): Promise<TrainingExample[]> {
    const examples: TrainingExample[] = [];
    const winner = game.result.winner;
    
    // Calculate game outcome value
    const outcomeValue = winner === 'Draw' ? 0 : 1;
    
    for (let i = 0; i < game.moves.length; i++) {
      const move = game.moves[i];
      const isWinnerMove = move.player === winner;
      
      // Skip if only winner moves requested
      if (options?.onlyWinnerMoves && !isWinnerMove && winner !== 'Draw') {
        continue;
      }
      
      // Calculate position value
      let value: number;
      if (winner === 'Draw') {
        value = 0;
      } else {
        // Decay value based on move distance from end
        const movesFromEnd = game.moves.length - i;
        const decay = Math.pow(0.95, movesFromEnd);
        value = isWinnerMove ? outcomeValue * decay : -outcomeValue * decay;
      }
      
      // Create base example
      const example: TrainingExample = {
        board: {
          board: this.boardToNumeric(move.board),
          player: move.player === 'Red' ? 1 : 2,
        },
        move: move.position,
        value,
      };
      
      // Add policy if available (from AI analysis)
      if (options?.includePolicy && move.board) {
        example.policy = await this.generatePolicy(move.board, move.position);
      }
      
      // Calculate example weight based on game quality
      example.weight = this.calculateExampleWeight(game, i);
      
      examples.push(example);
      
      // Apply augmentation if requested
      if (options?.augment) {
        const augmented = this.augmentExample(example, options.augment);
        examples.push(...augmented);
      }
    }
    
    return examples;
  }

  /**
   * Generate self-play data
   */
  async generateSelfPlayData(
    aiService: any, // Your AI service
    numGames: number,
    options?: {
      temperature?: number;
      explorationRate?: number;
      symmetricGames?: boolean;
    }
  ): Promise<TrainingExample[]> {
    this.logger.log(`Generating ${numGames} self-play games`);
    
    const allExamples: TrainingExample[] = [];
    const temperature = options?.temperature || 1.0;
    
    for (let gameNum = 0; gameNum < numGames; gameNum++) {
      const gameExamples: TrainingExample[] = [];
      const board = this.createEmptyBoard();
      let currentPlayer: 'Red' | 'Yellow' = 'Red';
      const moves: any[] = [];
      
      // Play game
      while (true) {
        // Get AI prediction
        const prediction = await aiService.predict(board);
        
        // Apply temperature to policy
        const policy = this.applyTemperature(prediction.policy, temperature);
        
        // Sample move from policy
        const move = this.sampleFromPolicy(policy, this.getValidMoves(board));
        
        // Store example
        gameExamples.push({
          board: {
            board: this.boardToNumeric(board),
            player: currentPlayer === 'Red' ? 1 : 2,
          },
          move,
          value: 0, // Will be filled after game ends
          policy,
        });
        
        // Make move
        this.makeMove(board, move, currentPlayer);
        moves.push({ position: move, player: currentPlayer, board: this.copyBoard(board) });
        
        // Check game end
        const result = this.checkGameEnd(board);
        if (result) {
          // Update values based on game outcome
          this.updateExampleValues(gameExamples, result.winner);
          
          // Save game record
          const gameRecord: GameRecord = {
            id: `selfplay_${Date.now()}_${gameNum}`,
            timestamp: new Date(),
            players: {
              red: { type: 'ai', rating: 2000 },
              yellow: { type: 'ai', rating: 2000 },
            },
            moves,
            result: {
              winner: result.winner,
              reason: 'normal',
            },
            metadata: {
              selfPlay: true,
              temperature,
            },
          };
          
          await this.saveGame(gameRecord);
          break;
        }
        
        // Switch players
        currentPlayer = currentPlayer === 'Red' ? 'Yellow' : 'Red';
      }
      
      // Add symmetric game if requested
      if (options?.symmetricGames) {
        const flippedExamples = gameExamples.map(ex => this.flipExample(ex));
        allExamples.push(...flippedExamples);
      }
      
      allExamples.push(...gameExamples);
      
      // Progress update
      if ((gameNum + 1) % 10 === 0) {
        this.logger.log(`Generated ${gameNum + 1}/${numGames} games`);
        
        this.eventEmitter.emit('training.selfplay.progress', {
          current: gameNum + 1,
          total: numGames,
          examplesGenerated: allExamples.length,
        });
      }
    }
    
    this.logger.log(`Self-play complete. Generated ${allExamples.length} examples`);
    
    return allExamples;
  }

  /**
   * Create a curated dataset
   */
  async createDataset(
    name: string,
    options: {
      gameIds?: string[];
      dateRange?: { start: Date; end: Date };
      minRating?: number;
      includeHumanGames?: boolean;
      includeSelfPlay?: boolean;
      maxExamples?: number;
      balanceClasses?: boolean;
    }
  ): Promise<string> {
    this.logger.log(`Creating dataset: ${name}`);
    
    const examples: TrainingExample[] = [];
    
    // Load games based on criteria
    const games = await this.loadGames(options);
    
    // Convert games to examples
    for (const game of games) {
      const gameExamples = await this.gameToTrainingExamples(game, {
        includePolicy: true,
        augment: {
          horizontalFlip: true,
          addNoise: false,
          rotateBoard: false,
          valueSmoothing: true,
          policySmoothing: true,
        },
      });
      
      examples.push(...gameExamples);
      
      // Check max examples
      if (options.maxExamples && examples.length >= options.maxExamples) {
        break;
      }
    }
    
    // Balance classes if requested
    let finalExamples = examples;
    if (options.balanceClasses) {
      finalExamples = this.balanceDataset(examples);
    }
    
    // Save dataset
    const datasetPath = path.join(this.datasetsDir, `${name}.json.gz`);
    const jsonData = JSON.stringify({
      name,
      created: new Date(),
      options,
      examples: finalExamples,
      stats: this.calculateDatasetStats(finalExamples),
    });
    
    const compressed = await this.compress(Buffer.from(jsonData));
    await fs.writeFile(datasetPath, compressed);
    
    this.logger.log(`Dataset ${name} created with ${finalExamples.length} examples`);
    
    return datasetPath;
  }

  /**
   * Load a dataset
   */
  async loadDataset(name: string): Promise<TrainingExample[]> {
    const datasetPath = path.join(this.datasetsDir, `${name}.json.gz`);
    
    const compressed = await fs.readFile(datasetPath);
    const decompressed = await this.decompress(compressed);
    const data = JSON.parse(decompressed.toString());
    
    return data.examples;
  }

  /**
   * Analyze position frequency
   */
  async analyzePositionFrequency(
    examples: TrainingExample[]
  ): Promise<Map<string, number>> {
    const frequency = new Map<string, number>();
    
    for (const example of examples) {
      const hash = this.hashPosition(example.board.board);
      frequency.set(hash, (frequency.get(hash) || 0) + 1);
    }
    
    // Sort by frequency
    const sorted = new Map(
      [...frequency.entries()].sort((a, b) => b[1] - a[1])
    );
    
    return sorted;
  }

  /**
   * Remove duplicate positions
   */
  deduplicateExamples(examples: TrainingExample[]): TrainingExample[] {
    const seen = new Set<string>();
    const unique: TrainingExample[] = [];
    
    for (const example of examples) {
      const hash = this.hashPosition(example.board.board);
      
      if (!seen.has(hash)) {
        seen.add(hash);
        unique.push(example);
      }
    }
    
    this.logger.log(`Deduplicated ${examples.length} to ${unique.length} examples`);
    
    return unique;
  }

  /**
   * Filter examples by quality
   */
  filterByQuality(
    examples: TrainingExample[],
    criteria: {
      minWeight?: number;
      minPolicyEntropy?: number;
      maxValueUncertainty?: number;
    }
  ): TrainingExample[] {
    return examples.filter(example => {
      // Check weight
      if (criteria.minWeight && (example.weight || 1) < criteria.minWeight) {
        return false;
      }
      
      // Check policy entropy
      if (criteria.minPolicyEntropy && example.policy) {
        const entropy = this.calculateEntropy(example.policy);
        if (entropy < criteria.minPolicyEntropy) {
          return false;
        }
      }
      
      // Check value uncertainty
      if (criteria.maxValueUncertainty) {
        const uncertainty = Math.abs(example.value);
        if (uncertainty > criteria.maxValueUncertainty) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Private helper methods
   */

  private async initializeDirectories(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.gamesDir, { recursive: true });
    await fs.mkdir(this.datasetsDir, { recursive: true });
  }

  private boardToNumeric(board: CellValue[][]): number[][] {
    return board.map(row =>
      row.map(cell => {
        if (cell === 'Red') return 1;
        if (cell === 'Yellow') return 2;
        return 0;
      })
    );
  }

  private createEmptyBoard(): CellValue[][] {
    return Array(6).fill(null).map(() => Array(7).fill('Empty'));
  }

  private copyBoard(board: CellValue[][]): CellValue[][] {
    return board.map(row => [...row]);
  }

  private makeMove(board: CellValue[][], col: number, player: 'Red' | 'Yellow'): void {
    for (let row = 5; row >= 0; row--) {
      if (board[row][col] === 'Empty') {
        board[row][col] = player;
        break;
      }
    }
  }

  private getValidMoves(board: CellValue[][]): number[] {
    const moves: number[] = [];
    for (let col = 0; col < 7; col++) {
      if (board[0][col] === 'Empty') {
        moves.push(col);
      }
    }
    return moves;
  }

  private checkGameEnd(board: CellValue[][]): { winner: 'Red' | 'Yellow' | 'Draw' } | null {
    // Check for wins
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        const cell = board[r][c];
        if (cell === 'Empty') continue;
        
        // Check horizontal, vertical, and diagonals
        if (this.checkWinFrom(board, r, c, cell as 'Red' | 'Yellow')) {
          return { winner: cell as 'Red' | 'Yellow' };
        }
      }
    }
    
    // Check for draw
    if (this.getValidMoves(board).length === 0) {
      return { winner: 'Draw' };
    }
    
    return null;
  }

  private checkWinFrom(
    board: CellValue[][],
    row: number,
    col: number,
    player: 'Red' | 'Yellow'
  ): boolean {
    const directions = [
      [0, 1], [1, 0], [1, 1], [1, -1]
    ];
    
    for (const [dr, dc] of directions) {
      let count = 1;
      
      // Check forward
      for (let i = 1; i < 4; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
          count++;
        } else {
          break;
        }
      }
      
      // Check backward
      for (let i = 1; i < 4; i++) {
        const r = row - dr * i;
        const c = col - dc * i;
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

  private applyTemperature(policy: number[], temperature: number): number[] {
    if (temperature === 0) {
      // Greedy selection
      const maxIdx = policy.indexOf(Math.max(...policy));
      return policy.map((_, i) => i === maxIdx ? 1 : 0);
    }
    
    // Apply temperature
    const logits = policy.map(p => Math.log(p + 1e-8) / temperature);
    const maxLogit = Math.max(...logits);
    const exp = logits.map(l => Math.exp(l - maxLogit));
    const sum = exp.reduce((a, b) => a + b, 0);
    
    return exp.map(e => e / sum);
  }

  private sampleFromPolicy(policy: number[], validMoves: number[]): number {
    // Filter policy to valid moves
    const validPolicy = validMoves.map(m => policy[m]);
    const sum = validPolicy.reduce((a, b) => a + b, 0);
    
    // Sample
    let random = Math.random() * sum;
    for (let i = 0; i < validMoves.length; i++) {
      random -= validPolicy[i];
      if (random <= 0) {
        return validMoves[i];
      }
    }
    
    return validMoves[validMoves.length - 1];
  }

  private updateExampleValues(examples: TrainingExample[], winner: 'Red' | 'Yellow' | 'Draw'): void {
    const value = winner === 'Draw' ? 0 : 1;
    
    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];
      const isWinnerMove = 
        (winner === 'Red' && example.board.player === 1) ||
        (winner === 'Yellow' && example.board.player === 2);
      
      if (winner === 'Draw') {
        example.value = 0;
      } else {
        // Decay value based on move distance from end
        const movesFromEnd = examples.length - i;
        const decay = Math.pow(0.95, movesFromEnd);
        example.value = isWinnerMove ? value * decay : -value * decay;
      }
    }
  }

  private async generatePolicy(board: CellValue[][], actualMove: number): Promise<number[]> {
    // This would use your AI to generate policy
    // For now, return uniform policy with higher prob for actual move
    const policy = new Array(7).fill(0.1);
    policy[actualMove] = 0.4;
    
    // Normalize
    const sum = policy.reduce((a, b) => a + b, 0);
    return policy.map(p => p / sum);
  }

  private calculateExampleWeight(game: GameRecord, moveIndex: number): number {
    let weight = 1.0;
    
    // Higher weight for human games
    if (game.players.red.type === 'human' || game.players.yellow.type === 'human') {
      weight *= 1.5;
    }
    
    // Higher weight for high-rated games
    const avgRating = (
      (game.players.red.rating || 1500) + 
      (game.players.yellow.rating || 1500)
    ) / 2;
    weight *= avgRating / 1500;
    
    // Lower weight for very short or very long games
    const gameLength = game.moves.length;
    if (gameLength < 10 || gameLength > 35) {
      weight *= 0.8;
    }
    
    return weight;
  }

  private augmentExample(
    example: TrainingExample,
    options: DataAugmentationOptions
  ): TrainingExample[] {
    const augmented: TrainingExample[] = [];
    
    if (options.horizontalFlip) {
      augmented.push(this.flipExample(example));
    }
    
    if (options.addNoise) {
      augmented.push(this.addNoiseToExample(example));
    }
    
    if (options.valueSmoothing) {
      augmented.push(this.smoothValue(example));
    }
    
    return augmented;
  }

  private flipExample(example: TrainingExample): TrainingExample {
    const flipped: TrainingExample = {
      board: {
        board: example.board.board.map(row => row.slice().reverse()),
        player: example.board.player,
      },
      move: 6 - example.move,
      value: example.value,
      weight: example.weight,
    };
    
    if (example.policy) {
      flipped.policy = example.policy.slice().reverse();
    }
    
    return flipped;
  }

  private addNoiseToExample(example: TrainingExample): TrainingExample {
    const noisy = { ...example };
    
    // Add small noise to value
    noisy.value += (Math.random() - 0.5) * 0.1;
    noisy.value = Math.max(-1, Math.min(1, noisy.value));
    
    // Add noise to policy
    if (noisy.policy) {
      noisy.policy = noisy.policy.map(p => {
        const noise = (Math.random() - 0.5) * 0.05;
        return Math.max(0, p + noise);
      });
      
      // Renormalize
      const sum = noisy.policy.reduce((a, b) => a + b, 0);
      noisy.policy = noisy.policy.map(p => p / sum);
    }
    
    return noisy;
  }

  private smoothValue(example: TrainingExample): TrainingExample {
    // Smooth extreme values towards 0
    const smoothed = { ...example };
    smoothed.value *= 0.9;
    return smoothed;
  }

  private hashPosition(board: number[][]): string {
    const flat = board.flat().join('');
    return crypto.createHash('md5').update(flat).digest('hex');
  }

  private calculateEntropy(policy: number[]): number {
    return -policy.reduce((sum, p) => {
      return sum + (p > 0 ? p * Math.log(p) : 0);
    }, 0);
  }

  private balanceDataset(examples: TrainingExample[]): TrainingExample[] {
    // Group by value ranges
    const groups: Record<string, TrainingExample[]> = {
      win: [],
      loss: [],
      draw: [],
    };
    
    for (const example of examples) {
      if (example.value > 0.5) {
        groups.win.push(example);
      } else if (example.value < -0.5) {
        groups.loss.push(example);
      } else {
        groups.draw.push(example);
      }
    }
    
    // Find minimum group size
    const minSize = Math.min(
      groups.win.length,
      groups.loss.length,
      groups.draw.length
    );
    
    // Sample equally from each group
    const balanced: TrainingExample[] = [];
    
    for (const group of Object.values(groups)) {
      // Shuffle and take minSize examples
      const shuffled = group.sort(() => Math.random() - 0.5);
      balanced.push(...shuffled.slice(0, minSize));
    }
    
    return balanced.sort(() => Math.random() - 0.5);
  }

  private calculateDatasetStats(examples: TrainingExample[]): DatasetStats {
    const uniquePositions = new Set<string>();
    let redWins = 0;
    let yellowWins = 0;
    let totalMoves = 0;
    
    for (const example of examples) {
      uniquePositions.add(this.hashPosition(example.board.board));
      
      if (example.value > 0.8 && example.board.player === 1) redWins++;
      if (example.value > 0.8 && example.board.player === 2) yellowWins++;
      
      totalMoves++;
    }
    
    return {
      totalExamples: examples.length,
      uniquePositions: uniquePositions.size,
      winRateRed: redWins / examples.length,
      winRateYellow: yellowWins / examples.length,
      averageGameLength: totalMoves / uniquePositions.size,
      positionFrequency: new Map(), // Would calculate if needed
    };
  }

  private async loadGames(options: any): Promise<GameRecord[]> {
    const games: GameRecord[] = [];
    
    // Load all game files
    const gameFiles = await fs.readdir(this.gamesDir);
    
    for (const file of gameFiles) {
      if (!file.endsWith('.json.gz')) continue;
      
      const gamePath = path.join(this.gamesDir, file);
      const compressed = await fs.readFile(gamePath);
      const decompressed = await this.decompress(compressed);
      const game = JSON.parse(decompressed.toString());
      
      // Apply filters
      if (options.gameIds && !options.gameIds.includes(game.id)) continue;
      
      if (options.dateRange) {
        const gameDate = new Date(game.timestamp);
        if (gameDate < options.dateRange.start || gameDate > options.dateRange.end) {
          continue;
        }
      }
      
      games.push(game);
    }
    
    return games;
  }

  private async compress(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (err, compressed) => {
        if (err) reject(err);
        else resolve(compressed);
      });
    });
  }

  private async decompress(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gunzip(data, (err, decompressed) => {
        if (err) reject(err);
        else resolve(decompressed);
      });
    });
  }

  /**
   * List available datasets
   */
  async listDatasets(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.datasetsDir);
      return files.filter(f => f.endsWith('.json.gz')).map(f => f.replace('.json.gz', ''));
    } catch (error) {
      return [];
    }
  }
}