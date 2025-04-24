#!/usr/bin/env python3
"""
Script: fine_tune.py
Perform mixed offline and online training of the Connect4 policy network using a replay buffer.
"""
import sys
import os
import argparse
import pickle
import random
import logging
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader

# ensure src/ is on path for model import
base_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(base_dir / 'src'))
from policy_net import Connect4PolicyNet  # type: ignore

# ----------------------------------------------------------------------------
# Config and logging
# ----------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ----------------------------------------------------------------------------
# Game utilities
# ----------------------------------------------------------------------------
ROWS, COLS = 6, 7

def make_empty_board():
    return [['Empty' for _ in range(COLS)] for _ in range(ROWS)]

def drop(board, col, disc):
    # mutates board
    for r in range(ROWS-1, -1, -1):
        if board[r][col] == 'Empty':
            board[r][col] = disc
            return True
    return False

# ----------------------------------------------------------------------------
# Dataset
# ----------------------------------------------------------------------------
class Connect4Dataset(Dataset):
    def __init__(self, examples):
        self.examples = examples

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, idx):
        # each example is (layers, move)
        layers, move = self.examples[idx]
        # convert to tensor
        x = torch.tensor(layers, dtype=torch.float32)
        y = torch.tensor(move, dtype=torch.long)
        return x, y

# ----------------------------------------------------------------------------
# Training loop
# ----------------------------------------------------------------------------
def fine_tune(
    base_model_path: Path,
    buffer_path: Path,
    output_model_path: Path,
    epochs: int,
    batch_size: int,
    lr: float,
    historic_ratio: float
):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    logger.info(f"Using device: {device}")

    # Load base model
    model = Connect4PolicyNet().to(device)
    checkpoint = torch.load(base_model_path, map_location=device)
    state = checkpoint.get('model_state_dict', checkpoint)
    model.load_state_dict(state)
    model.train()

    # Load replay buffer
    with open(buffer_path, 'rb') as f:
        games = pickle.load(f)
    logger.info(f"Loaded {len(games)} games from replay buffer")

    # Build examples: list of (layers, move)
    examples = []
    for game in games:
        board = make_empty_board()
        for i, move in enumerate(game['moves']):
            # prepare numeric masks
            mapping = {'Empty': 0.0, 'Red': 1.0, 'Yellow': -1.0}
            numeric = [[mapping[cell] for cell in row] for row in board]
            red_mask = [[1.0 if v == 1.0 else 0.0 for v in row] for row in numeric]
            yellow_mask = [[1.0 if v == -1.0 else 0.0 for v in row] for row in numeric]
            layers = [red_mask, yellow_mask]
            examples.append((layers, move))
            # apply drop for next state
            disc = 'Red' if i % 2 == 0 else 'Yellow'
            drop(board, move, disc)
    logger.info(f"Constructed {len(examples)} training examples")

    # Shuffle examples
    random.shuffle(examples)
    split = int(len(examples) * historic_ratio)
    historic_ex = examples[:split]
    live_ex     = examples[split:]
    mixed_ex    = historic_ex + live_ex
    logger.info(f"Mixed dataset: {len(historic_ex)} historic + {len(live_ex)} live examples")

    dataset = Connect4Dataset(mixed_ex)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    # Optimizer and loss
    optimizer = optim.Adam(model.parameters(), lr=lr)
    criterion = nn.CrossEntropyLoss()

    # Training epochs
    for epoch in range(1, epochs + 1):
        total_loss = 0.0
        for x_batch, y_batch in loader:
            x_batch = x_batch.to(device)        # shape [B, 2, 6, 7]
            y_batch = y_batch.to(device)        # shape [B]

            optimizer.zero_grad()
            logits = model(x_batch)             # shape [B, 7]
            loss = criterion(logits, y_batch)
            loss.backward()
            optimizer.step()

            total_loss += loss.item() * x_batch.size(0)
        avg_loss = total_loss / len(dataset)
        logger.info(f"Epoch {epoch}/{epochs} — Avg loss: {avg_loss:.4f}")

    # Save fine-tuned model
    torch.save({'model_state_dict': model.state_dict()}, output_model_path)
    logger.info(f"Saved fine-tuned model to {output_model_path}")

# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Fine-tune Connect4 policy network')
    parser.add_argument('--base-model', '-b', required=True, help='Path to base checkpoint')
    parser.add_argument('--buffer',     '-B', required=True, help='Path to replay_buffer.pkl')
    parser.add_argument('--output',     '-o', required=True, help='Path to write new checkpoint')
    parser.add_argument('--epochs',     '-e', type=int, default=3, help='Number of epochs')
    parser.add_argument('--batch-size', '-bs', type=int, default=64, help='Batch size')
    parser.add_argument('--lr',          '-l', type=float, default=1e-4, help='Learning rate')
    parser.add_argument('--historic',    '-r', type=float, default=0.8, help='Ratio of historic vs new data')
    args = parser.parse_args()

    fine_tune(
        Path(args.base_model),
        Path(args.buffer),
        Path(args.output),
        args.epochs,
        args.batch_size,
        args.lr,
        args.historic
    )
