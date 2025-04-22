import { Injectable, NotFoundException } from '@nestjs/common';
import { Server } from 'socket.io';
import { getBestAIMove } from '../ai/aiEngine';
import type { CellValue } from '../ai/types';

export interface GameState {
  board: CellValue[][];
  currentPlayer: CellValue;
  players: string[];
}

@Injectable()
export class GameService {
  private static readonly ROWS = 6;
  private static readonly COLS = 7;

  private server: Server;
  private games = new Map<string, GameState>();

  setServer(server: Server) {
    this.server = server;
  }

  async createGame(playerId: string, clientId: string): Promise<string> {
    const gameId = this.generateGameId();
    const emptyBoard = Array.from({ length: GameService.ROWS }, () =>
      Array(GameService.COLS).fill('Empty' as CellValue)
    );
    this.games.set(gameId, {
      board: emptyBoard,
      currentPlayer: playerId as CellValue,
      players: [playerId as CellValue, 'Yellow' as CellValue],
    });
    return gameId;
  }

  async joinGame(
    gameId: string,
    playerId: string,
    clientId: string
  ): Promise<{ board: CellValue[][]; currentPlayer: CellValue } | { error: string }> {
    const game = this.games.get(gameId);
    if (!game) return { error: 'Game not found.' };
    if (game.players.includes(playerId)) return { error: 'Player already joined.' };
    if (game.players.length >= 2) return { error: 'Game is full.' };

    game.players.push(playerId);
    return { board: game.board, currentPlayer: game.currentPlayer };
  }

  async dropDisc(
    gameId: string,
    playerId: string,
    column: number
  ): Promise<{
    success: boolean;
    board?: CellValue[][];
    winner?: string;
    draw?: boolean;
    nextPlayer?: string;
    error?: string;
  }> {
    const game = this.games.get(gameId);
    if (!game) return { success: false, error: 'Game not found.' };
    if (!game.players.includes(playerId)) return { success: false, error: 'Player not in game.' };
    if (game.currentPlayer !== playerId) return { success: false, error: 'Not your turn.' };
    if (column < 0 || column >= GameService.COLS) return { success: false, error: 'Column out of range.' };

    let placedRow = -1;
    for (let r = GameService.ROWS - 1; r >= 0; r--) {
      if (game.board[r][column] === 'Empty') {
        game.board[r][column] = playerId as CellValue;
        placedRow = r;
        break;
      }
    }
    if (placedRow === -1) return { success: false, error: 'Column is full.' };

    const color = game.board[placedRow][column];
    const won = this.checkWin(game.board, placedRow, column, color);

    let winner: string | undefined;
    let draw = false;
    let nextPlayer: string | undefined;

    if (won) {
      winner = playerId;
    } else if (game.board[0].every(cell => cell !== 'Empty')) {
      draw = true;
    } else {
      nextPlayer = game.players.find(p => p !== playerId)!;
      game.currentPlayer = nextPlayer as CellValue;
    }

    return { success: true, board: game.board, winner, draw, nextPlayer };
  }

  handleDisconnect(clientId: string) {
    for (const [gid, game] of this.games.entries()) {
      const idx = game.players.indexOf(clientId);
      if (idx !== -1) {
        game.players.splice(idx, 1);
        if (game.players.length === 0) this.games.delete(gid);
        else game.currentPlayer = game.players[0] as CellValue;
      }
    }
  }

  handleLeave(gameId: string, playerId: string) {
    const game = this.games.get(gameId);
    if (!game) return;
    const idx = game.players.indexOf(playerId);
    if (idx !== -1) {
      game.players.splice(idx, 1);
      if (game.players.length === 0) this.games.delete(gameId);
      else game.currentPlayer = game.players[0] as CellValue;
    }
  }

  getBoard(gameId: string): CellValue[][] {
    const game = this.games.get(gameId);
    if (!game) {
      throw new NotFoundException(`Game not found: ${gameId}`);
    }
    return game.board.map(row => [...row])
  }

  async getAIMove(gameId: string, aiDisc: CellValue): Promise<{ column: number }> {
    const state = this.games.get(gameId);
    if (!state) throw new NotFoundException('Game not found');
    return { column: getBestAIMove(state.board, aiDisc) };
  }

  private generateGameId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private checkWin(
    board: CellValue[][],
    row: number,
    col: number,
    color: CellValue
  ): boolean {
    const dirs = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];
    for (const [dr, dc] of dirs) {
      let count = 1;
      for (const sign of [1, -1] as const) {
        let r = row + dr * sign,
          c = col + dc * sign;
        while (
          r >= 0 &&
          r < GameService.ROWS &&
          c >= 0 &&
          c < GameService.COLS &&
          board[r][c] === color
        ) {
          count++;
          r += dr * sign;
          c += dc * sign;
        }
      }
      if (count >= 4) return true;
    }
    return false;
  }
}
