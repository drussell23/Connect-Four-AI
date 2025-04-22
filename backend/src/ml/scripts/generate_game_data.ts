// backend/src/ml/scripts/generate_game_data.ts
import * as fs from 'fs';
import * as path from 'path';
import { getBestAIMove, tryDrop, legalMoves, CellValue, bitboardCheckWin, getBits } from '../../ai/connect4AI';

const RAW_DATA = path.resolve(__dirname, '../data/raw_games.json');

type Example = {
  board: CellValue[][];
  move: number;
  outcome: 'win'|'loss'|'draw';
};

function playOneGame(): Example[] {
  let board = Array.from({ length: 6 }, () => Array(7).fill('Empty') as CellValue[]);
  let current: CellValue = 'Red';
  const log: Example[] = [];

  while (true) {
    const move = getBestAIMove(board, current);
    log.push({ board: structuredClone(board), move, outcome: 'draw' }); // temporary outcome
    const { board: next, row } = tryDrop(board, move, current);
    board = next;

    // check for win/draw
    const won = bitboardCheckWin(getBits(board, current));
    if (won || legalMoves(board).length === 0) {
      const result: 'win'|'loss'|'draw' = won
        ? 'win'
        : 'draw';
      // fix up last entries’ outcomes
      return log.map((ex, i) => ({
        ...ex,
        outcome: i === log.length - 1
          ? result
          : 'draw'
      }));
    }

    current = current === 'Red' ? 'Yellow' : 'Red';
  }
}

function generate(nGames = 1000) {
  const all: Example[] = [];
  for (let i = 0; i < nGames; i++) {
    all.push(...playOneGame());
  }
  fs.writeFileSync(RAW_DATA, JSON.stringify(all, null, 2));
  console.log(`Wrote ${all.length} examples to ${RAW_DATA}`);
}

generate(500);
