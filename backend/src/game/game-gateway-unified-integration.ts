/**
 * Unified AI Integration for GameGateway
 * 
 * This file shows how to integrate the UnifiedAISystem to replace all scattered AI logic
 * with a single, consistent implementation
 */

import { UnifiedAISystem, UnifiedAIConfig } from '../ai/unified/unified-ai-system-simple';
import { Board, CellValue as UnifiedCellValue } from '../ai/unified/unified-threat-detector.service';

export class UnifiedGameGatewayIntegration {
  /**
   * Replace the existing triggerAIMove method with this unified version
   */
  static async triggerAIMoveUnified(
    this: any, // GameGateway context
    gameId: string,
    playerId: string
  ): Promise<void> {
    try {
      this.logger.log(`[${gameId}] 🎯 Triggering Unified AI System`);
      
      const game = this.gameService.getGame(gameId);
      if (!game) {
        this.logger.error(`[${gameId}] Game not found for AI move`);
        return;
      }

      const startTime = Date.now();
      const difficulty = game.difficulty || 5;

      // Convert board to unified format
      const unifiedBoard: Board = game.board.map((row: any[]) => 
        row.map((cell: any) => {
          if (cell === 'Red') return 'Red' as UnifiedCellValue;
          if (cell === 'Yellow') return 'Yellow' as UnifiedCellValue;
          return 'Empty' as UnifiedCellValue;
        })
      );

      // Check if unified AI system is available
      if (!this.unifiedAISystem) {
        this.logger.error(`[${gameId}] Unified AI System not available`);
        // Fall back to legacy implementation
        await this.triggerAIMoveLegacy(gameId, playerId);
        return;
      }

      // Emit AI thinking status
      this.server.to(gameId).emit('aiThinking', {
        status: 'analyzing',
        capabilities: [
          'unified_threat_detection',
          'multi_algorithm_support', 
          'pattern_recognition',
          'opening_book',
          'endgame_tablebase'
        ],
        mode: 'unified_system'
      });

      // Configure AI based on difficulty and game settings
      const config: UnifiedAIConfig = {
        difficulty,
        personality: game.aiPersonality || 'balanced',
        timeLimit: 5000,
        useCache: true,
        learningEnabled: true,
        explanationLevel: 'detailed'
      };

      // Get AI decision from unified system
      const decision = await this.unifiedAISystem.makeMove(
        unifiedBoard,
        'Yellow' as UnifiedCellValue, // AI is always Yellow
        config
      );

      // Log comprehensive decision details
      this.logger.log(`[${gameId}] 🤖 Unified AI Decision:`);
      this.logger.log(`  • Column: ${decision.move}`);
      this.logger.log(`  • Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
      this.logger.log(`  • Strategy: ${decision.strategy}`);
      this.logger.log(`  • Algorithm: ${decision.metadata.algorithm}`);
      this.logger.log(`  • Time: ${decision.metadata.computationTime}ms`);
      if (decision.metadata.nodesEvaluated) {
        this.logger.log(`  • Nodes: ${decision.metadata.nodesEvaluated}`);
      }

      // Natural thinking delay
      const thinkingDelay = Math.max(
        this.AI_THINK_DELAY_MS - decision.metadata.computationTime,
        100
      );
      await new Promise(resolve => setTimeout(resolve, thinkingDelay));

      // Execute the move
      const moveResult = await this.gameService.dropDisc(gameId, 'AI', decision.move);
      
      if (!moveResult.success) {
        throw new Error(moveResult.error || 'Move execution failed');
      }

      // Emit comprehensive AI move result
      this.server.to(gameId).emit('aiMove', {
        column: decision.move,
        board: moveResult.board,
        lastMove: { 
          column: decision.move, 
          playerId: 'AI',
          confidence: decision.confidence,
          strategy: decision.strategy,
          explanation: decision.explanation
        },
        winner: moveResult.winner,
        draw: moveResult.draw,
        nextPlayer: moveResult.nextPlayer,
        gameMetrics: moveResult.gameMetrics,
        aiExplanation: decision.explanation,
        // Enhanced metadata from unified system
        aiMetadata: {
          algorithm: decision.metadata.algorithm,
          processingTime: decision.metadata.computationTime,
          nodesEvaluated: decision.metadata.nodesEvaluated,
          cacheHit: decision.metadata.cacheHit,
          threatAnalysis: decision.metadata.threatAnalysis,
          alternatives: decision.alternatives
        }
      });

      this.logger.log(
        `[${gameId}] ✅ Unified AI played column ${decision.move} ` +
        `(${decision.metadata.algorithm}, ${decision.confidence * 100}% confidence)`
      );

    } catch (error: any) {
      this.logger.error(`[${gameId}] Unified AI error: ${error.message}`);
      
      // Emergency fallback
      try {
        const game = this.gameService.getGame(gameId);
        if (game) {
          // Use quick move from unified system
          const quickMove = await this.unifiedAISystem.quickMove(
            this.convertBoardToUnified(game.board),
            'Yellow' as UnifiedCellValue
          );
          
          const moveResult = await this.gameService.dropDisc(gameId, 'AI', quickMove);
          if (moveResult.success) {
            this.server.to(gameId).emit('aiMove', {
              column: quickMove,
              board: moveResult.board,
              lastMove: { column: quickMove, playerId: 'AI' },
              winner: moveResult.winner,
              draw: moveResult.draw,
              aiExplanation: 'Emergency quick move'
            });
            return;
          }
        }
      } catch (fallbackError) {
        this.logger.error(`[${gameId}] Fallback also failed: ${fallbackError.message}`);
      }

      this.server.to(gameId).emit('error', {
        event: 'aiMove',
        message: 'AI system failure',
        details: error.message
      });
    }
  }

  /**
   * Replace getQuickStrategicMove with this unified version
   */
  static async getQuickStrategicMoveUnified(
    this: any,
    board: any[][]
  ): Promise<number> {
    if (!this.unifiedAISystem) {
      // Fallback to legacy implementation
      return this.getQuickStrategicMoveLegacy(board);
    }

    try {
      const unifiedBoard = this.convertBoardToUnified(board);
      return await this.unifiedAISystem.quickMove(
        unifiedBoard,
        'Yellow' as UnifiedCellValue
      );
    } catch (error) {
      this.logger.error(`Quick move error: ${error.message}`);
      // Simple fallback
      for (let col = 0; col < 7; col++) {
        if (board[0][col] === 'Empty') return col;
      }
      return 3;
    }
  }

  /**
   * Replace getStreamlinedAIMove with unified system
   */
  static async getStreamlinedAIMoveUnified(
    this: any,
    gameId: string,
    board: any[][],
    playerId: string
  ): Promise<any> {
    if (!this.unifiedAISystem) {
      return this.getStreamlinedAIMoveLegacy(gameId, board, playerId);
    }

    try {
      const unifiedBoard = this.convertBoardToUnified(board);
      const game = this.gameService.getGame(gameId);
      const difficulty = game?.difficulty || 5;

      const config: UnifiedAIConfig = {
        difficulty,
        timeLimit: 3000, // Faster for streamlined
        useCache: true,
        learningEnabled: false,
        explanationLevel: 'basic'
      };

      const decision = await this.unifiedAISystem.makeMove(
        unifiedBoard,
        'Yellow' as UnifiedCellValue,
        config
      );

      return {
        column: decision.move,
        confidence: decision.confidence,
        explanation: decision.explanation,
        strategy: decision.strategy
      };
    } catch (error) {
      this.logger.error(`Streamlined AI error: ${error.message}`);
      // Fallback
      const quickMove = await this.getQuickStrategicMoveUnified.call(this, board);
      return {
        column: quickMove,
        confidence: 0.5,
        explanation: 'Fallback move',
        strategy: 'fallback'
      };
    }
  }

  /**
   * Helper to convert board format
   */
  static convertBoardToUnified(board: any[][]): Board {
    return board.map(row => 
      row.map(cell => {
        if (cell === 'Red') return 'Red' as UnifiedCellValue;
        if (cell === 'Yellow') return 'Yellow' as UnifiedCellValue;
        return 'Empty' as UnifiedCellValue;
      })
    );
  }

  /**
   * Get AI system status
   */
  static async getAISystemStatus(this: any): Promise<any> {
    if (!this.unifiedAISystem) {
      return { available: false, reason: 'Unified AI System not initialized' };
    }

    return {
      available: true,
      ...this.unifiedAISystem.getSystemStatus()
    };
  }

  /**
   * Handle AI configuration updates
   */
  static async updateAIConfiguration(
    this: any,
    config: Partial<UnifiedAIConfig>
  ): Promise<void> {
    if (!this.unifiedAISystem) {
      throw new Error('Unified AI System not available');
    }

    // Update configuration
    this.logger.log(`Updating AI configuration: ${JSON.stringify(config)}`);
    // Implementation depends on how config is stored
  }
}

/**
 * Integration steps:
 * 
 * 1. Add UnifiedAISystem to GameGateway constructor:
 *    private readonly unifiedAISystem?: UnifiedAISystem
 * 
 * 2. Replace methods in GameGateway:
 *    - triggerAIMove -> triggerAIMoveUnified
 *    - getQuickStrategicMove -> getQuickStrategicMoveUnified
 *    - getStreamlinedAIMove -> getStreamlinedAIMoveUnified
 * 
 * 3. Add helper method:
 *    private convertBoardToUnified = UnifiedGameGatewayIntegration.convertBoardToUnified
 * 
 * 4. Add status endpoint:
 *    @SubscribeMessage('getAISystemStatus')
 *    async handleGetAISystemStatus() {
 *      return UnifiedGameGatewayIntegration.getAISystemStatus.call(this);
 *    }
 */