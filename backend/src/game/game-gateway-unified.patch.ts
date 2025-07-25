/**
 * Patch file to integrate Unified AI System into GameGateway
 * 
 * This file shows the minimal changes needed to integrate the unified AI system
 * while maintaining backward compatibility with existing AI systems.
 */

// Add to imports:
import { UnifiedAICoordinatorService } from '../ai/unified/unified-ai-coordinator.service';
import { Board, CellValue as UnifiedCellValue } from '../ai/unified/unified-threat-detector.service';

// Add to constructor parameters:
// private readonly unifiedAICoordinator?: UnifiedAICoordinatorService,

// Replace makeAiMove method with this enhanced version:
export async function makeAiMoveUnified(
  this: any, // GameGateway context
  gameId: string,
  game: any
): Promise<void> {
  const difficulty = game.difficulty || 5;
  
  // Convert board format if needed
  const unifiedBoard: Board = game.board.map((row: any[]) => 
    row.map((cell: any) => {
      if (cell === 'Red') return 'Red' as UnifiedCellValue;
      if (cell === 'Yellow') return 'Yellow' as UnifiedCellValue;
      return 'Empty' as UnifiedCellValue;
    })
  );

  try {
    // Emit AI thinking event
    this.server.to(gameId).emit('aiStatus', {
      type: 'thinking',
      message: 'AI is analyzing the board...',
      gameId,
      timestamp: Date.now()
    });

    // Use unified AI coordinator if available
    if (this.unifiedAICoordinator) {
      this.logger.log(`🎯 [${gameId}] Using Unified AI System`);
      
      const response = await this.unifiedAICoordinator.getAIMove(
        gameId,
        unifiedBoard,
        'Yellow' as UnifiedCellValue, // AI is always Yellow
        difficulty,
        {
          timeLimit: 5000,
          useCache: true
        }
      );

      // Log decision details
      this.logger.log(`🤖 [${gameId}] Unified AI Decision:`);
      this.logger.log(`  • Column: ${response.move}`);
      this.logger.log(`  • Confidence: ${(response.decision.confidence * 100).toFixed(1)}%`);
      this.logger.log(`  • Strategy: ${response.decision.strategy}`);
      this.logger.log(`  • Source: ${response.source}`);
      this.logger.log(`  • Time: ${response.metadata.processingTime}ms`);

      // Natural thinking delay
      const thinkingDelay = Math.max(
        this.AI_THINK_DELAY_MS - response.metadata.processingTime,
        100
      );
      await new Promise(resolve => setTimeout(resolve, thinkingDelay));

      // Make the move
      const moveResult = await this.gameService.dropDisc(gameId, 'AI', response.move);
      
      if (!moveResult.success) {
        throw new Error(moveResult.error || 'Move failed');
      }

      // Emit the AI move with enhanced data
      this.server.to(gameId).emit('aiMove', {
        board: moveResult.board,
        lastMove: { 
          column: response.move, 
          playerId: 'AI',
          confidence: response.decision.confidence,
          strategy: response.decision.strategy,
          explanation: response.decision.explanation
        },
        winner: moveResult.winner,
        draw: moveResult.draw,
        gameMetrics: moveResult.gameMetrics,
        aiExplanation: response.decision.explanation,
        aiMetadata: {
          processingTime: response.metadata.processingTime,
          threatDetectionUsed: response.metadata.threatDetectionUsed,
          cacheHit: response.metadata.cacheUtilized,
          source: response.source
        }
      });

    } else {
      // Fallback to original AI implementation
      this.logger.log(`📦 [${gameId}] Using Legacy AI System`);
      await this.makeAiMoveLegacy(gameId, game);
    }

  } catch (error: any) {
    this.logger.error(`❌ [${gameId}] AI move error: ${error.message}`);
    
    // Emergency fallback - use quick strategic move
    try {
      const quickMove = await this.getQuickStrategicMove(game.board);
      if (quickMove !== -1) {
        const moveResult = await this.gameService.dropDisc(gameId, 'AI', quickMove);
        if (moveResult.success) {
          this.server.to(gameId).emit('aiMove', {
            board: moveResult.board,
            lastMove: { column: quickMove, playerId: 'AI' },
            winner: moveResult.winner,
            draw: moveResult.draw,
            aiExplanation: 'Emergency fallback move'
          });
          return;
        }
      }
    } catch (fallbackError) {
      this.logger.error(`Double failure in AI move: ${fallbackError.message}`);
    }

    this.server.to(gameId).emit('error', {
      event: 'aiMove',
      message: 'AI failed to make a move',
      details: error.message
    });
  }
}

// Add this method to check unified AI status:
export function getUnifiedAIStatus(this: any): any {
  if (this.unifiedAICoordinator) {
    return this.unifiedAICoordinator.getSystemStatus();
  }
  return { available: false, reason: 'Unified AI Coordinator not injected' };
}

// Update handleDropDisc to use unified threat detection for validation:
export async function validateMoveWithUnifiedAI(
  this: any,
  board: any[][],
  column: number,
  playerId: string
): Promise<{ valid: boolean; warning?: string }> {
  if (!this.unifiedAICoordinator) {
    return { valid: true }; // No validation if unified AI not available
  }

  try {
    // Convert board for unified AI
    const unifiedBoard: Board = board.map(row => 
      row.map(cell => {
        if (cell === 'Red') return 'Red' as UnifiedCellValue;
        if (cell === 'Yellow') return 'Yellow' as UnifiedCellValue;
        return 'Empty' as UnifiedCellValue;
      })
    );

    // Quick threat analysis
    const playerColor = playerId === 'AI' ? 'Yellow' : 'Red';
    const analysis = await this.unifiedAICoordinator.analyzeBoard(
      unifiedBoard, 
      playerColor as UnifiedCellValue
    );

    // Check if player is missing a critical block
    if (analysis.immediateBlocks.length > 0 && 
        !analysis.immediateBlocks.some(block => block.column === column)) {
      return {
        valid: true,
        warning: `You might want to block at column ${analysis.immediateBlocks[0].column + 1}!`
      };
    }

    return { valid: true };
  } catch (error) {
    this.logger.error(`Move validation error: ${error.message}`);
    return { valid: true }; // Don't block moves on validation errors
  }
}