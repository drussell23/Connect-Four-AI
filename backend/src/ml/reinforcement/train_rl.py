import argparse
from pathlib import Path

import numpy as np 
import tensorflow as tf 

# Game constants
ROWS, COLS = 6, 7
WIN_LENGTH = 4


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
    # horizontal, vertical, diagonal ↘ ↗
    lines = []
    # horizontal
    for r in range(ROWS):
        for c in range(COLS - WIN_LENGTH + 1):
            lines.append([board[r][c+i] for i in range(WIN_LENGTH)])
    # vertical
    for c in range(COLS):
        for r in range(ROWS - WIN_LENGTH + 1):
            lines.append([board[r+i][c] for i in range(WIN_LENGTH)])
    # diag ↘
    for r in range(ROWS - WIN_LENGTH + 1):
        for c in range(COLS - WIN_LENGTH + 1):
            lines.append([board[r+i][c+i] for i in range(WIN_LENGTH)])
    # diag ↗
    for r in range(WIN_LENGTH-1, ROWS):
        for c in range(COLS - WIN_LENGTH + 1):
            lines.append([board[r-i][c+i] for i in range(WIN_LENGTH)])
    for line in lines:
        if abs(sum(line)) == WIN_LENGTH:
            return int(np.sign(sum(line)))
    return 0


def encode_board(board, player):
    # encode from perspective of `player`: 1 for player, -1 for opponent, 0 empty
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


def build_model(lr):
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(ROWS*COLS,)),
        tf.keras.layers.Dense(128, activation='relu'),
        tf.keras.layers.Dense(128, activation='relu'),
        tf.keras.layers.Dense(COLS, activation='softmax'),
    ])
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=lr),
        loss='categorical_crossentropy'
    )
    return model


def discount_rewards(rewards, gamma):
    discounted = np.zeros_like(rewards, dtype=np.float32)
    running = 0.0
    for t in reversed(range(len(rewards))):
        running = rewards[t] + gamma * running
        discounted[t] = running
    # normalize
    mean, std = discounted.mean(), discounted.std() + 1e-8
    return (discounted - mean) / std


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--episodes', type=int, default=10000)
    parser.add_argument('--batch_size', type=int, default=32)
    parser.add_argument('--gamma', type=float, default=0.99)
    parser.add_argument('--lr', type=float, default=1e-3)
    parser.add_argument('--save_interval', type=int, default=500)
    args = parser.parse_args()

    model = build_model(args.lr)
    save_path = Path(__file__).resolve().parent.parent / 'models' / 'connect4' / 'keras_model.h5'
    save_path.parent.mkdir(parents=True, exist_ok=True)

    # Training loop
    episode_buffer = []
    for ep in range(1, args.episodes + 1):
        board = init_board()
        player = 1  # start with agent = 1
        states, actions, rewards = [], [], []
        done = False

        # play one episode
        while not done:
            legal = get_legal_moves(board)
            state_enc = encode_board(board, player)
            probs = model.predict(state_enc[None, :], verbose=0)[0]
            # mask illegal
            mask = np.zeros_like(probs)
            mask[legal] = 1
            probs = probs * mask
            if probs.sum() == 0:
                probs[legal] = 1
            probs = probs / probs.sum()

            action = np.random.choice(range(COLS), p=probs)
            states.append(state_enc)
            acts = np.zeros(COLS)
            acts[action] = 1
            actions.append(acts)

            drop_piece(board, action, player)
            winner = check_winner(board)
            if winner != 0:
                rewards = [1 if p == winner else -1 for p in [player]*len(states)]
                done = True
            elif not get_legal_moves(board):
                rewards = [0 for _ in states]
                done = True
            else:
                player = -player
                continue

        # accumulate episode
        episode_buffer.append((states, actions, rewards))

        # batch update
        if len(episode_buffer) >= args.batch_size or ep == args.episodes:
            # collect batch
            batch_states = []
            batch_actions = []
            batch_rewards = []
            for st, ac, rw in episode_buffer:
                dr = discount_rewards(rw, args.gamma)
                batch_states.extend(st)
                batch_actions.extend(ac)
                batch_rewards.extend(dr)
            # train
            model.train_on_batch(
                np.vstack(batch_states),
                np.vstack(batch_actions),
                sample_weight=np.array(batch_rewards)
            )
            episode_buffer = []

        # save periodically
        if ep % args.save_interval == 0:
            model.save(save_path)
            print(f"Episode {ep}: model saved to {save_path}")

    # final save
    model.save(save_path)
    print(f"Training complete. Final model saved to {save_path}")


if __name__ == '__main__':
    main()
