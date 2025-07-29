import { Injectable } from '@nestjs/common';
import { Game } from '../game/entities/game.entity';

interface MoveConflict {
  type: 'move';
  index: number;
  clientMove: any;
  serverMove: any;
}

interface StateConflict {
  type: 'state';
  field: string;
  clientValue: any;
  serverValue: any;
}

export type ConflictResolutionStrategy = 'server-first' | 'client-first' | 'newest' | 'merge';

@Injectable()
export class ConflictResolutionService {
  
  async detectMoveConflicts(game: Game, clientMoves: any[]): Promise<MoveConflict[]> {
    const conflicts: MoveConflict[] = [];
    const serverMoves = game.moves || [];
    
    // Compare move sequences
    const minLength = Math.min(serverMoves.length, clientMoves.length);
    
    for (let i = 0; i < minLength; i++) {
      const serverMove = serverMoves[i];
      const clientMove = clientMoves[i];
      
      if (serverMove.column !== clientMove.column ||
          serverMove.player !== clientMove.player ||
          Math.abs(serverMove.createdAt.getTime() - clientMove.timestamp) > 1000) {
        conflicts.push({
          type: 'move',
          index: i,
          clientMove,
          serverMove
        });
        break; // Stop at first divergence
      }
    }
    
    return conflicts;
  }

  async detectStateConflicts(serverGame: Game, clientState: any): Promise<StateConflict[]> {
    const conflicts: StateConflict[] = [];
    
    // Check board state
    const serverBoardHash = this.hashBoard(serverGame.board);
    const clientBoardHash = this.hashBoard(clientState.board);
    
    if (serverBoardHash !== clientBoardHash) {
      conflicts.push({
        type: 'state',
        field: 'board',
        clientValue: clientState.board,
        serverValue: serverGame.board
      });
    }
    
    // Check current player
    if (serverGame.currentPlayer !== clientState.currentPlayer) {
      conflicts.push({
        type: 'state',
        field: 'currentPlayer',
        clientValue: clientState.currentPlayer,
        serverValue: serverGame.currentPlayer
      });
    }
    
    // Check game status
    if (serverGame.status !== clientState.status) {
      conflicts.push({
        type: 'state',
        field: 'status',
        clientValue: clientState.status,
        serverValue: serverGame.status
      });
    }
    
    return conflicts;
  }

  async resolveConflicts(
    conflicts: MoveConflict[],
    strategy: ConflictResolutionStrategy
  ): Promise<{ moves: any[] }> {
    switch (strategy) {
      case 'server-first':
        // Server state takes precedence
        return { moves: [] };
        
      case 'client-first':
        // Client moves take precedence
        return { 
          moves: conflicts.map(c => c.clientMove) 
        };
        
      case 'newest':
        // Compare timestamps and keep newest
        return {
          moves: conflicts.map(c => 
            c.clientMove.timestamp > c.serverMove.createdAt.getTime() 
              ? c.clientMove 
              : null
          ).filter(Boolean)
        };
        
      case 'merge':
        // Try to merge both sequences
        return this.mergeMoveLists(conflicts);
        
      default:
        return { moves: [] };
    }
  }

  async resolveStateConflicts(
    conflicts: StateConflict[],
    serverGame: Game,
    clientState: any
  ): Promise<{ mergedState: any }> {
    const mergedState = { ...serverGame };
    
    for (const conflict of conflicts) {
      switch (conflict.field) {
        case 'board':
          // Use board with more moves
          const serverMoves = this.countMoves(serverGame.board);
          const clientMoves = this.countMoves(clientState.board);
          
          if (clientMoves > serverMoves) {
            mergedState.board = clientState.board;
            mergedState.currentPlayer = clientState.currentPlayer;
          }
          break;
          
        case 'status':
          // Game over status takes precedence
          if (clientState.status !== 'active' && serverGame.status === 'active') {
            mergedState.status = clientState.status;
            mergedState.winner = clientState.winner;
          }
          break;
      }
    }
    
    return { mergedState };
  }

  private mergeMoveLists(conflicts: MoveConflict[]): { moves: any[] } {
    // Simple merge strategy - would be more sophisticated in production
    const moves: any[] = [];
    
    for (const conflict of conflicts) {
      // If moves are at different positions, likely offline play
      if (conflict.clientMove.column !== conflict.serverMove.column) {
        // Keep client move if it's valid
        moves.push(conflict.clientMove);
      }
    }
    
    return { moves };
  }

  private hashBoard(board: any[][]): string {
    return board.flat().map(cell => 
      cell === 'Red' ? 'R' : cell === 'Yellow' ? 'Y' : '_'
    ).join('');
  }

  private countMoves(board: any[][]): number {
    return board.flat().filter(cell => cell !== 'Empty').length;
  }
}