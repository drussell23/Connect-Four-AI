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
//  - Error handling and per-game timing
//  - Summary statistics
// ----------------------------------------------------------------------------

// CLI setup
const program = new Command();
program
  .option('-n, --games <number>', 'number of games to generate', '20000')
  .option('-o, --output <path>', 'output JSON file', path.resolve(__dirname, '../data/raw_games.json'))
  .option('-v, --verbose', 'enable verbose (DEBUG) logging')
  .option('-l, --log-file <path>', 'optional log file to write logs')
  .parse(process.argv);

const opts = program.opts() as {
  games: string;
  output: string;
  verbose: boolean;
  logFile?: string;
};
const N_GAMES = parseInt(opts.games, 10);
const LOG_FILE = opts.logFile;

// Logging utilities
enum Level { INFO = 'INFO', WARN = 'WARN', ERROR = 'ERROR', DEBUG = 'DEBUG' }
const levelColor: Record<Level, string> = {
  [Level.INFO]: '\x1b[32m',
  [Level.WARN]: '\x1b[33m',
  [Level.ERROR]: '\x1b[31m',
  [Level.DEBUG]: '\x1b[34m',
};
function writeLog(line: string) {
  if (LOG_FILE) {
    fs.appendFile(LOG_FILE, line + '\n').catch(() => {});
  }
}
function log(level: Level, msg: string) {
  if (!opts.verbose && level === Level.DEBUG) return;
  const ts = new Date().toISOString();
  const line = `${levelColor[level]}[${ts}] [${level}] ${msg}\x1b[0m`;
  console.log(line);
  writeLog(`[${ts}] [${level}] ${msg}`);
}

// Data types
type Example = {
  board: CellValue[][];
  move: number;
  player: CellValue;
  outcome: 'win' | 'draw';
  ply: number;
  gameIndex: number;
  timestamp: string;
};

// Play one game to completion
function playOneGame(gameIndex: number): Example[] {
  let board = Array.from({ length: 6 }, () => Array(7).fill('Empty') as CellValue[]);
  let current: CellValue = 'Red';
  const history: Example[] = [];
  let ply = 0;

  while (true) {
    ply++;
    const ts = new Date().toISOString();
    const move = getBestAIMove(board, current);
    log(Level.DEBUG, `Game ${gameIndex} Ply ${ply}: Player ${current} -> move ${move}`);

    history.push({ board: structuredClone(board), move, player: current, outcome: 'draw', ply, gameIndex, timestamp: ts });
    const { board: nextBoard } = tryDrop(board, move, current);
    board = nextBoard;

    const isWin = bitboardCheckWin(getBits(board, current));
    const movesLeft = legalMoves(board).length;
    if (isWin || movesLeft === 0) {
      const finalOutcome: 'win' | 'draw' = isWin ? 'win' : 'draw';
      log(Level.INFO, `Game ${gameIndex} finished in ${ply} plies: ${current} ${finalOutcome}`);
      history[history.length - 1].outcome = finalOutcome;
      return history;
    }
    current = current === 'Red' ? 'Yellow' : 'Red';
  }
}

async function main() {
  log(Level.INFO, `Starting generation of ${N_GAMES} games`);
  const runner = new cliProgress.SingleBar({
    format: 'Progress |{bar}| {percentage}% || {value}/{total} games',
    hideCursor: true
  });
  runner.start(N_GAMES, 0);

  const allExamples: Example[] = [];
  let redWins = 0, yellowWins = 0, draws = 0;
  let totalPlies = 0;
  const startAll = Date.now();

  for (let i = 1; i <= N_GAMES; i++) {
    const startGame = Date.now();
    try {
      const gameData = playOneGame(i);
      allExamples.push(...gameData);
      const last = gameData[gameData.length - 1];
      if (last.outcome === 'win') {
        last.player === 'Red' ? redWins++ : yellowWins++;
      } else {
        draws++;
      }
      totalPlies += gameData.length;
      const dur = ((Date.now() - startGame) / 1000).toFixed(2);
      log(Level.DEBUG, `Game ${i} took ${dur}s with ${gameData.length} plies`);
    } catch (err) {
      log(Level.ERROR, `Game ${i} error: ${(err as Error).message}, skipping`);
    }
    runner.increment();
  }

  runner.stop();
  const totalSec = ((Date.now() - startAll) / 1000).toFixed(2);
  log(Level.INFO, `Completed ${N_GAMES} games in ${totalSec}s`);
  log(Level.INFO, `Red wins: ${redWins}, Yellow wins: ${yellowWins}, Draws: ${draws}`);
  log(Level.INFO, `Average plies per game: ${(totalPlies / N_GAMES).toFixed(1)}`);

  try {
    await fs.writeFile(opts.output, JSON.stringify(allExamples, null, 2));
    log(Level.INFO, `Wrote ${allExamples.length} examples to ${opts.output}`);
  } catch (err) {
    log(Level.ERROR, `Failed to write output file: ${(err as Error).message}`);
    process.exit(1);
  }
}

main().catch(err => {
  log(Level.ERROR, `Unhandled error: ${(err as Error).message}`);
  process.exit(1);
});
