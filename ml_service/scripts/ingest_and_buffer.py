#!/usr/bin/env python3
"""
Script: ingest_and_buffer.py
Read live game logs and update a pickled replay buffer with the most recent N games.
"""
import sys
import os
import json
import pickle
import logging
import argparse
from pathlib import Path
from datetime import datetime

# ----------------------------------------------------------------------------
# Logging setup
# ----------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ----------------------------------------------------------------------------
# Main logic
# ----------------------------------------------------------------------------
def load_live_games(log_file: Path):
    """Load JSON lines from live_games.jsonl into a list of dicts."""
    games = []
    if not log_file.exists():
        logger.warning(f"Live log file not found: {log_file}")
        return games
    with log_file.open('r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                games.append(entry)
            except json.JSONDecodeError as e:
                logger.error(f"Skipping invalid JSON line: {e}")
    logger.info(f"Loaded {len(games)} live games from {log_file}")
    return games


def load_buffer(buffer_file: Path):
    """Load existing replay buffer from pickle, or return empty list."""
    if buffer_file.exists():
        try:
            with buffer_file.open('rb') as f:
                buffer = pickle.load(f)
            logger.info(f"Loaded {len(buffer)} games from replay buffer {buffer_file}")
            return buffer
        except Exception as e:
            logger.error(f"Error loading buffer: {e}")
    else:
        logger.info(f"No existing buffer found at {buffer_file}, starting new.")
    return []


def save_buffer(buffer_file: Path, buffer):
    """Save the replay buffer as a pickle file."""
    buffer_file.parent.mkdir(parents=True, exist_ok=True)
    with buffer_file.open('wb') as f:
        pickle.dump(buffer, f)
    logger.info(f"Saved {len(buffer)} games to replay buffer {buffer_file}")


def prune_buffer(buffer, max_size: int):
    """Keep only the most recent max_size games based on timestamp."""
    # Each entry should have a 'timestamp' field
    sorted_games = sorted(buffer, key=lambda g: g.get('timestamp', 0))
    if len(sorted_games) > max_size:
        sorted_games = sorted_games[-max_size:]
        logger.info(f"Pruned buffer to {max_size} most recent games")
    return sorted_games


def main():
    parser = argparse.ArgumentParser(description='Ingest live games and update replay buffer')
    parser.add_argument('--live-log', '-l', type=str,
                        default=os.path.join('data', 'live_games.jsonl'),
                        help='Path to live game JSONL log')
    parser.add_argument('--buffer', '-b', type=str,
                        default=os.path.join('data', 'replay_buffer.pkl'),
                        help='Path to pickle replay buffer')
    parser.add_argument('--max-size', '-m', type=int,
                        default=1000,
                        help='Maximum number of games to keep in buffer')
    args = parser.parse_args()

    live_log_path = Path(args.live_log)
    buffer_path   = Path(args.buffer)
    max_size      = args.max_size

    # Load
    live_games = load_live_games(live_log_path)
    buffer     = load_buffer(buffer_path)

    # Merge: append only new entries (by timestamp)
    existing_ts = {g.get('timestamp') for g in buffer}
    new_games = [g for g in live_games if g.get('timestamp') not in existing_ts]
    if new_games:
        logger.info(f"Adding {len(new_games)} new games to buffer")
        buffer.extend(new_games)
    else:
        logger.info("No new games to add to buffer")

    # Prune
    buffer = prune_buffer(buffer, max_size)

    # Save
    save_buffer(buffer_path, buffer)

if __name__ == '__main__':
    main()
