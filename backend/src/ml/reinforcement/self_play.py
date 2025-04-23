import argparse
import json
import random
import sys
from pathlib import Path

import numpy as np 
import tensorflow as tf 

# --- Game logic ---
ROWS, COLS = 6, 7
WIN_LEN = 4
CODE_TO_STR = {0: 'Empty', 1: 'Red', -1: 'Yellow'}


def init_board():
    return [[0 for _ in range(COLS)] for _ in range(ROWS)]


def get_legal_moves(board):
    return [c for c in range(COLS) if board[0][c] == 0]


def drop_piece(board, col, player):
    for r in range(ROWS-1, -1, -1):
        if board[r][col] == 0:
            board[r][col] = player
            return
    raise ValueError(f"Column {col} is full")


def check_winner(board):
    # returns 1 if Red wins, -1 if Yellow wins, 0 otherwise
    # horizontal, vertical, diag ↘ and ↗
    for r in range(ROWS):
        for c in range(COLS - WIN_LEN + 1):
            s = sum(board[r][c+i] for i in range(WIN_LEN))
            if abs(s) == WIN_LEN:
                return int(np.sign(s))
    for c in range(COLS):
        for r in range(ROWS - WIN_LEN + 1):
            s = sum(board[r+i][c] for i in range(WIN_LEN))
            if abs(s) == WIN_LEN:
                return int(np.sign(s))
    for r in range(ROWS - WIN_LEN + 1):
        for c in range(COLS - WIN_LEN + 1):
            s = sum(board[r+i][c+i] for i in range(WIN_LEN))
            if abs(s) == WIN_LEN:
                return int(np.sign(s))
    for r in range(WIN_LEN - 1, ROWS):
        for c in range(COLS - WIN_LEN + 1):
            s = sum(board[r-i][c+i] for i in range(WIN_LEN))
            if abs(s) == WIN_LEN:
                return int(np.sign(s))
    return 0


def encode_for_model(board, player):
    # encode from `player` perspective: 1 for player, 0 empty, -1 opponent
    flat = []
    for row in board:
        for cell in row:
            if cell == player:
                flat.append(1.0)
            elif cell == 0:
                flat.append(0.0)
            else:
                flat.append(-1.0)
    return np.array(flat, dtype=np.float32)


# --- Main script ---

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--episodes', type=int, default=10000,
                        help='Number of self-play games to generate')
    parser.add_argument('--model', type=Path,
                        help='Path to a Keras .h5 policy model (optional)')
    args = parser.parse_args()

    # Load model if provided
    model = None
    if args.model:
        if not args.model.is_file():
            sys.exit(f"Model not found at {args.model}")
        print(f"🔍 Loading policy model from {args.model}")
        model = tf.keras.models.load_model(str(args.model))

    data: list[dict] = []
    for ep in range(1, args.episodes + 1):
        board = init_board()
        player = 1  # 1=Red starts, -1=Yellow
        history: list[tuple[list[list[int]], int, int]] = []

        # Play one game
        while True:
            legal = get_legal_moves(board)
            if not legal:
                winner = 0
                break

            # Choose action
            if model:
                inp = encode_for_model(board, player)[None, :]
                probs = model.predict(inp, verbose=0)[0]
                # mask illegal
                mask = np.zeros_like(probs)
                mask[legal] = 1
                probs *= mask
                if probs.sum() == 0:
                    probs[legal] = 1.0
                probs /= probs.sum()
                action = int(np.random.choice(COLS, p=probs))
            else:
                action = random.choice(legal)

            # Record state and move
            history.append(([row.copy() for row in board], player, action))

            # Apply move
            drop_piece(board, action, player)
            winner = check_winner(board)
            if winner != 0:
                break
            player = -player

        # Compile examples
        outcome_label = 'draw' if winner == 0 else ('win' if winner == 1 else 'loss')
        for state, mover, move in history:
            # Convert numeric board to string labels
            board_str = [[CODE_TO_STR[cell] for cell in row] for row in state]
            # Determine outcome from mover's POV
            if winner == 0:
                res = 'draw'
            else:
                res = 'win' if mover == winner else 'loss'
            data.append({'board': board_str, 'move': move, 'outcome': res})

        if ep % 1000 == 0:
            print(f"Generated {ep} games...")

    # Write to file
    out_dir = Path(__file__).resolve().parent.parent / 'data'
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / 'raw_games.json'
    with open(out_file, 'w') as f:
        json.dump(data, f)
    print(f"🎉 Wrote {len(data)} examples to {out_file}")


if __name__ == '__main__':
    main()
