#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import * as path from 'path';
import { Command } from 'commander';

// Use require for cli-progress to avoid module interop issues.
const cliProgress = require('cli-progress');

import {
  getBestAIMove,
  tryDrop,
  legalMoves,
  CellValue,
  bitboardCheckWin,
  getBits
} from '../../ai/connect4AI';

// ----------------------------------------------------------------------------
// generate_game_data.ts
// Enhanced self-play data generation for Connect Four
// Features:
//  - CLI args (games count, output path, verbosity)
//  - Colored, leveled logs
//  - Progress bar
//  - Error handling
//  - Summary statistics
// ----------------------------------------------------------------------------

// CLI setup
const program = new Command();
program
  .option('-n, --games <number>', 'number of games to generate', '1000')
  .option('-o, --output <path>', 'output JSON file', path.resolve(__dirname, '../data/raw_games.json'))
  .option('-v, --verbose', 'enable verbose logging')
  .parse(process.argv);

const { games, output, verbose } = program.opts() as {
  games: string;
  output: string;
  verbose: boolean;
};
const N_GAMES = parseInt(games, 10);

// Logging utilities
enum Level { INFO = 'INFO', WARN = 'WARN', ERROR = 'ERROR', DEBUG = 'DEBUG' }
const levelColor: Record<Level, string> = {
  [Level.INFO]: '\x1b[32m',
  [Level.WARN]: '\x1b[33m',
  [Level.ERROR]: '\x1b[31m',
  [Level.DEBUG]: '\x1b[34m',
};
function log(level: Level, msg: string) {
  if (!verbose && level === Level.DEBUG) return;
  const ts = new Date().toISOString();
  console.log(`${levelColor[level]}[${ts}] [${level}] ${msg}\x1b[0m`);
}

// Data types
type Example = {
  board: CellValue[][];
  move: number;
  player: CellValue;
  outcome: 'win' | 'loss' | 'draw';
};

// Play one game to completion
function playOneGame(): Example[] {
  let board = Array.from({ length: 6 }, () => Array(7).fill('Empty') as CellValue[]);
  let current: CellValue = 'Red';
  const logEntries: Example[] = [];

  while (true) {
    const move = getBestAIMove(board, current);
    log(Level.DEBUG, `Player ${current} selects column ${move}`);
    logEntries.push({ board: structuredClone(board), move, player: current, outcome: 'draw' });

    const { board: nextBoard } = tryDrop(board, move, current);
    board = nextBoard;

    const isWin = bitboardCheckWin(getBits(board, current));
    const movesLeft = legalMoves(board).length;
    if (isWin || movesLeft === 0) {
      const finalOutcome: Example['outcome'] = isWin ? 'win' : 'draw';
      const winner = isWin ? current : 'None';
      log(Level.INFO, `Game end: ${winner} ${finalOutcome}`);

      // annotate outcome only on final entry
      return logEntries.map((ex, idx) => ({
        ...ex,
        outcome: idx === logEntries.length - 1 ? finalOutcome : 'draw'
      }));
    }

    // switch players
    current = current === 'Red' ? 'Yellow' : 'Red';
  }
}

async function main() {
  try {
    const runner = new cliProgress.SingleBar({
      format: 'Progress |{bar}| {percentage}% || {value}/{total} games',
      hideCursor: true
    });
    runner.start(N_GAMES, 0);

    const allExamples: Example[] = [];
    let redWins = 0, yellowWins = 0, draws = 0;
    let totalMoves = 0;
    const t0 = Date.now();

    for (let i = 0; i < N_GAMES; i++) {
      const start = Date.now();
      const gameData = playOneGame();
      allExamples.push(...gameData);
      const last = gameData[gameData.length - 1];

      // stats
      if (last.outcome === 'win') {
        last.player === 'Red' ? redWins++ : yellowWins++;
      } else if (last.outcome === 'draw') {
        draws++;
      }
      totalMoves += gameData.length;

      // update progress
      runner.increment();
      if (verbose && i % 100 === 0) {
        log(Level.DEBUG, `Completed ${i + 1} games in ${(Date.now() - start)/1000}s`);
      }
    }

    runner.stop();
    const duration = (Date.now() - t0) / 1000;

    // write output
    await fs.writeFile(output, JSON.stringify(allExamples, null, 2));

    // summary
    log(Level.INFO, `Generated ${N_GAMES} games in ${duration.toFixed(2)}s`);
    log(Level.INFO, `Red wins: ${redWins}, Yellow wins: ${yellowWins}, Draws: ${draws}`);
    log(Level.INFO, `Avg moves per game: ${(totalMoves/N_GAMES).toFixed(1)}`);
  } catch (err) {
    log(Level.ERROR, `Unhandled error: ${(err as Error).message}`);
    process.exit(1);
  }
}

// execute
main();
