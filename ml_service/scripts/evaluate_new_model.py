#!/usr/bin/env python3
"""
Script: evaluate_new_model.py
Simulate self-play between a new model and the previous model to measure performance.
"""
import sys
import os
import json
import logging
import torch
import argparse
from pathlib import Path
from datetime import datetime


# ----------------------------------------------------------------------------
# Setup logging
# ----------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ----------------------------------------------------------------------------
# Import Connect4PolicyNet
# ----------------------------------------------------------------------------
base_dir = Path(__file__).resolve().parent.parent
# ensure src/ is on path
sys.path.insert(0, str(base_dir / "src"))
from policy_net import Connect4PolicyNet  # type: ignore

# ----------------------------------------------------------------------------
# Connect 4 environment utilities
# ----------------------------------------------------------------------------
ROWS, COLS = 6, 7


def make_empty_board():
    return [["Empty" for _ in range(COLS)] for _ in range(ROWS)]


def drop(board, col, disc):
    for r in range(ROWS - 1, -1, -1):
        if board[r][col] == "Empty":
            board[r][col] = disc
            return True
    return False


def legal_moves(board):
    return [c for c in range(COLS) if board[0][c] == "Empty"]


def check_win(board, disc):
    # horizontal, vertical, diag
    for r in range(ROWS):
        for c in range(COLS):
            if board[r][c] != disc:
                continue
            # check directions
            for dr, dc in [(0, 1), (1, 0), (1, 1), (1, -1)]:
                count = 1
                rr, cc = r + dr, c + dc
                while 0 <= rr < ROWS and 0 <= cc < COLS and board[rr][cc] == disc:
                    count += 1
                    rr += dr
                    cc += dc
                if count >= 4:
                    return True
    return False


def get_model_move(model, board, ai_disc):
    # prepare tensor [1,2,6,7]
    mapping = {"Empty": 0.0, "Red": 1.0, "Yellow": -1.0}
    numeric = [[mapping[cell] for cell in row] for row in board]
    red_mask = [[1.0 if v == 1.0 else 0.0 for v in row] for row in numeric]
    yellow_mask = [[1.0 if v == -1.0 else 0.0 for v in row] for row in numeric]
    tensor = torch.tensor(
        [red_mask, yellow_mask], dtype=torch.float32, device=model.device
    ).unsqueeze(0)
    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1)[0].cpu()
        # choose highest-prob legal move
        legal = legal_moves(board)
        best = max(legal, key=lambda c: probs[c].item())
    return int(best)


def simulate_game(model_red, model_yellow):
    board = make_empty_board()
    current = "Red"
    move_count = 0
    while True:
        if current == "Red":
            col = get_model_move(model_red, board, "Red")
        else:
            col = get_model_move(model_yellow, board, "Yellow")

        if not drop(board, col, current):
            return 0  # draw on illegal move
        move_count += 1

        if check_win(board, current):
            return 1 if current == "Red" else -1

        if move_count >= ROWS * COLS:
            return 0  # draw

        current = "Yellow" if current == "Red" else "Red"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Evaluate a new model vs the previous by self-play."
    )
    parser.add_argument("--new", required=True, help="Path to new model checkpoint")
    parser.add_argument("--old", required=True, help="Path to old model checkpoint")
    parser.add_argument(
        "--games", type=int, default=50, help="Number of games to simulate"
    )
    parser.add_argument("--output", "-o", help="Output JSON report path")
    args = parser.parse_args()

    # load models
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    new_model = Connect4PolicyNet().to(device)
    old_model = Connect4PolicyNet().to(device)
    for model, path in [(new_model, args.new), (old_model, args.old)]:
        ckpt = torch.load(path, map_location=device)
        state = ckpt.get("model_state_dict", ckpt)
        model.load_state_dict(state)
        model.eval()

    results = {"new_wins": 0, "old_wins": 0, "draws": 0}
    for i in range(args.games):
        # alternate start: even index new starts
        if i % 2 == 0:
            res = simulate_game(new_model, old_model)
            if res == 1:
                results["new_wins"] += 1
            elif res == -1:
                results["old_wins"] += 1
            else:
                results["draws"] += 1
        else:
            # swap roles
            res = simulate_game(old_model, new_model)
            if res == 1:
                results["old_wins"] += 1
            elif res == -1:
                results["new_wins"] += 1
            else:
                results["draws"] += 1

    total = args.games
    results["total_games"] = total
    results["new_win_rate"] = round(results["new_wins"] / total, 4)
    results["timestamp"] = datetime.utcnow().isoformat() + "Z"

    # write report
    report_path = (
        Path(args.output) if args.output else (base_dir / "data" / "eval_report.json")
    )
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open("w") as f:
        json.dump(results, f, indent=2)

    print(json.dumps(results, indent=2))
