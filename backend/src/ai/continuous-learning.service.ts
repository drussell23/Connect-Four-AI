import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ContinuousLearningService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContinuousLearningService.name);
  private mlServiceUrl: string;
  private enabled = false;

  // Learning metrics
  private learningMetrics = {
    gamesProcessed: 0,
    lossesAnalyzed: 0,
    learnRequestsSent: 0,
    learnRequestsFailed: 0,
    patternCounts: {
      horizontal: 0,
      vertical: 0,
      diagonal: 0,
      'anti-diagonal': 0,
    } as Record<string, number>,
  };

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const disableExternalServices =
      this.configService.get('DISABLE_EXTERNAL_SERVICES', 'false') === 'true';
    const enableContinuousLearning =
      this.configService.get('ENABLE_CONTINUOUS_LEARNING', 'true') === 'true';

    if (disableExternalServices || !enableContinuousLearning) {
      this.logger.log('Continuous Learning Service disabled');
      return;
    }

    this.mlServiceUrl =
      this.configService.get('ML_SERVICE_URL') || 'http://localhost:8000';
    this.enabled = true;
    this.setupEventListeners();
    this.logger.log(
      `Continuous Learning Service initialized (ML: ${this.mlServiceUrl})`,
    );
  }

  async onModuleDestroy() {
    this.enabled = false;
  }

  private setupEventListeners() {
    // Learn from every completed game
    this.eventEmitter.on(
      'game.completed.for.learning',
      async (gameData: any) => {
        this.learningMetrics.gamesProcessed++;
        await this.sendLearnRequest(gameData);
      },
    );

    // Track loss patterns
    this.eventEmitter.on('ai.critical.loss', async (data: any) => {
      this.learningMetrics.lossesAnalyzed++;
      if (data.lossPattern?.type) {
        const t = data.lossPattern.type;
        this.learningMetrics.patternCounts[t] =
          (this.learningMetrics.patternCounts[t] || 0) + 1;
      }
    });
  }

  /**
   * Send game data to ML service /learn endpoint via HTTP
   */
  private async sendLearnRequest(gameData: any): Promise<void> {
    if (!this.enabled) return;

    // Extract AI moves and their board states from the move list
    const aiMoves: number[] = [];
    const boardStates: string[][][] = [];

    const moves = gameData.moves || [];
    for (const move of moves) {
      if (move.player === 'Yellow' || move.player === 'AI') {
        aiMoves.push(move.column);
        if (move.boardState) {
          boardStates.push(move.boardState);
        }
      }
    }

    // If no board states were tracked per-move, use the final board
    if (boardStates.length === 0 && gameData.board) {
      boardStates.push(gameData.board);
      if (aiMoves.length === 0) {
        // Can't learn without knowing what moves the AI made
        return;
      }
      // Trim moves to match board states
      while (aiMoves.length > boardStates.length) {
        boardStates.unshift(gameData.board);
      }
    }

    if (aiMoves.length === 0 || boardStates.length === 0) return;

    const payload = {
      game_id: gameData.gameId,
      outcome: gameData.outcome, // 'win', 'loss', 'draw'
      board_states: boardStates,
      moves: aiMoves,
      ai_level: gameData.aiLevel || 5,
      loss_pattern: gameData.lossPattern || null,
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${this.mlServiceUrl}/learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        this.learningMetrics.learnRequestsSent++;
        const result = await res.json();
        this.logger.debug(
          `Learn request accepted: ${result.experiences_added} experiences, buffer=${result.buffer_size}`,
        );
      } else {
        this.learningMetrics.learnRequestsFailed++;
        this.logger.warn(`Learn request failed: ${res.status}`);
      }
    } catch (error: any) {
      this.learningMetrics.learnRequestsFailed++;
      // Don't spam logs if ML service is down
      this.logger.debug(`ML service unreachable for learning: ${error.message}`);
    }
  }

  getLearningMetrics() {
    return { ...this.learningMetrics, enabled: this.enabled };
  }
}
