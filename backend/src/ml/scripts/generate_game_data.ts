// backend/src/ml/scripts/generate_game_data.ts
import * as fs from 'fs';
import * as path from 'path';
import {
  getBestAIMove,
  tryDrop,
  legalMoves,
  CellValue,
  bitboardCheckWin,
  getBits
} from '../../ai/connect4AI';  // Adjust the relative path as needed

const RAW_DATA = path.resolve(__dirname, '../data/raw_games.json');
const DEFAULT_GAMES = 30;

type Example = {
  board: CellValue[][];
  move: number;
  player: CellValue;
  outcome: 'win' | 'loss' | 'draw';
};

function playOneGame(): Example[] {
  let board = Array.from({ length: 6 }, () => Array(7).fill('Empty') as CellValue[]);
  let current: CellValue = 'Red';
  const log: Example[] = [];

  while (true) {
    const move = getBestAIMove(board, current);
    log.push({ board: structuredClone(board), move, player: current, outcome: 'draw' });
    const { board: next } = tryDrop(board, move, current);
    board = next;

    const win = bitboardCheckWin(getBits(board, current));
    const movesLeft = legalMoves(board).length;
    if (win || movesLeft === 0) {
      const result: 'win' | 'loss' | 'draw' = win ? 'win' : 'draw';
      return log.map((ex, idx) => ({
        ...ex,
        outcome: idx === log.length - 1 ? result : 'draw'
      }));
    }

    current = current === 'Red' ? 'Yellow' : 'Red';
  }
}

function generate(nGames = DEFAULT_GAMES) {
  const all: Example[] = [];

  let redWins = 0;
  let yellowWins = 0;
  let draws = 0;

  console.log(`=== Starting generation of ${nGames} self-play games ===`);
  console.log(`Raw output path: ${RAW_DATA}\n`);

  for (let i = 0; i < nGames; i++) {
    const gameIndex = i + 1;
    console.log(`--- Game ${gameIndex} of ${nGames} started ---`);
    const startTime = Date.now();

    // Play one full game and collect examples
    const gameExamples = playOneGame();
    all.push(...gameExamples);

    // End-of-game logging
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    const moves = gameExamples.length;
    const last = gameExamples[moves - 1];
    const winner = last.outcome === 'draw' ? 'None (draw)' : last.player;

    // Update stats
    if (last.outcome === 'win') {
      last.player === 'Red' ? redWins++ : yellowWins++;
    } else if (last.outcome === 'draw') {
      draws++;
    }

    console.log(`Result: ${winner} wins outcome=${last.outcome}`);
    console.log(`Moves played: ${moves}, Duration: ${durationSec}s`);
    console.log(`Cumulative stats -> Red: ${redWins}, Yellow: ${yellowWins}, Draws: ${draws}`);

    // Compute and display progress
    const percent = ((gameIndex) / nGames) * 100;
    console.log(`Progress: ${gameIndex}/${nGames} games completed (${percent.toFixed(1)}%)\n`);
  }

  console.log(`Writing ${all.length} examples to ${RAW_DATA}...`);
  fs.writeFileSync(RAW_DATA, JSON.stringify(all, null, 2));

  console.log(`=== Generation complete: ${all.length} examples written ===`);
}

generate();
