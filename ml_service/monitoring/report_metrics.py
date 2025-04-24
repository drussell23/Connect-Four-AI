#!/usr/bin/env python3
"""
Script: report_metrics.py
Compute simple performance metrics from logged games and emit a JSON report.
"""
import sys
import os
import json
from pathlib import Path
from datetime import datetime

# Allow importing schemas from ml_service root
base_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(base_dir))

try:
    from schemas.game_log import GameLog
except ImportError:
    GameLog = None  # fallback if Pydantic not available


def load_game_logs(log_file: Path):
    """Load and parse JSON lines from live_games.jsonl"""
    logs = []
    if not log_file.exists():
        return logs
    with log_file.open('r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                # Validate with GameLog if available
                if GameLog:
                    try:
                        entry = GameLog(**entry).dict()
                    except Exception:
                        continue
                logs.append(entry)
            except json.JSONDecodeError:
                continue
    return logs


def compute_metrics(logs: list):
    """Compute total games, win/draw/loss counts and rates."""
    total = len(logs)
    wins = sum(1 for g in logs if g.get('outcome') == 1)
    draws = sum(1 for g in logs if g.get('outcome') == 0)
    losses = sum(1 for g in logs if g.get('outcome') == -1)
    win_rate = wins / total if total else 0.0
    return {
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'total_games': total,
        'ai_wins': wins,
        'draws': draws,
        'ai_losses': losses,
        'win_rate': round(win_rate, 4),
    }


def main(output_file: Path = None):
    data_dir = base_dir / 'data'
    log_file = data_dir / 'live_games.jsonl'
    metrics = compute_metrics(load_game_logs(log_file))

    # Write metrics to JSON file if requested
    if not output_file:
        output_file = data_dir / 'metrics_report.json'
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with output_file.open('w') as f:
        json.dump(metrics, f, indent=2)

    # Print summary
    print(json.dumps(metrics, indent=2))


if __name__ == '__main__':
    # Optionally allow specifying an output path
    import argparse
    parser = argparse.ArgumentParser(description='Generate AI performance metrics report from live game logs.')
    parser.add_argument('--output', '-o', type=str, help='Path to write metrics JSON')
    args = parser.parse_args()
    out_path = Path(args.output) if args.output else None
    main(out_path)
