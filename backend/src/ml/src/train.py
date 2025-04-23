import os
import json
import random
import argparse
import logging

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader, random_split
from tensorboardX import SummaryWriter

from policy_net import Connect4PolicyNet

# -----------------------------------------------------------------------------
# Constants & Seeding
# -----------------------------------------------------------------------------
SEED = 42
random.seed(SEED)
torch.manual_seed(SEED)


# -----------------------------------------------------------------------------
# Logging setup
# -----------------------------------------------------------------------------
def setup_logging(log_file: str):
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s: %(message)s",
        handlers=[logging.FileHandler(log_file), logging.StreamHandler()],
    )


# -----------------------------------------------------------------------------
# Data loader
# -----------------------------------------------------------------------------
def load_data(data_path: str) -> TensorDataset:
    """
    Load and preprocess connect-four training data.
    Supports flat 42-length feature vectors (one channel: -1/0/1) and
    two-channel 84-length vectors (Red + Yellow planes).
    """
    with open(data_path, "r") as f:
        raw = json.load(f)

    boards, moves = [], []
    if not isinstance(raw, list):
        raise ValueError(f"Expected top-level JSON list, got {type(raw)}")

    for ex in raw:
        # Determine move label
        if "label" in ex:
            move = ex["label"]
        elif "value" in ex:
            move = ex["value"]
        else:
            raise KeyError(f"Missing 'label' or 'value' in example: {list(ex.keys())}")

        # Extract features
        feats = ex.get("features")
        if feats is not None:
            if len(feats) == 2 * 6 * 7:
                flat = feats
            elif len(feats) == 6 * 7:
                red_plane = [1.0 if f == 1 else 0.0 for f in feats]
                yellow_plane = [1.0 if f == -1 else 0.0 for f in feats]
                flat = red_plane + yellow_plane
            else:
                raise ValueError(
                    f"Unsupported 'features' length: expected 42 or 84, got {len(feats)}"
                )
        else:
            board_data = ex.get("board", ex.get("state"))
            if board_data is None:
                raise KeyError(f"Missing board data in example: {list(ex.keys())}")
            red_plane, yellow_plane = [], []
            for row in board_data:
                for c in row:
                    red_plane.append(1.0 if c == "Red" else 0.0)
                    yellow_plane.append(1.0 if c == "Yellow" else 0.0)
            flat = red_plane + yellow_plane

        if len(flat) != 2 * 6 * 7:
            raise ValueError(
                f"Feature vector must have length 84 (2x6x7), got {len(flat)}"
            )

        boards.append(flat)
        moves.append(move)

    X = torch.tensor(boards, dtype=torch.float32)
    y = torch.tensor(moves, dtype=torch.long)
    return TensorDataset(X, y)


# -----------------------------------------------------------------------------
# Training loop
# -----------------------------------------------------------------------------
def train(dataset, model, criterion, optimizer, scheduler, device, config):
    val_size = int(len(dataset) * config.val_split)
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_ds, batch_size=config.batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=config.batch_size)

    writer = SummaryWriter(log_dir=config.log_dir)
    best_val_loss = float("inf")

    for epoch in range(1, config.epochs + 1):
        # Log training progress
        percent = (epoch - 1) / config.epochs * 100
        logging.info(
            f"Starting epoch {epoch}/{config.epochs} ({percent:.1f}% complete)"
        )

        # Training phase
        model.train()
        total_loss = 0.0
        for batch_idx, (xb, yb) in enumerate(train_loader, 1):
            xb, yb = xb.to(device), yb.to(device)
            optimizer.zero_grad()
            logits = model(xb.view(xb.size(0), 2, 6, 7))
            loss = criterion(logits, yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * xb.size(0)
            if batch_idx % max(1, len(train_loader) // 10) == 0:
                batch_pct = batch_idx / len(train_loader) * 100
                logging.info(
                    f"  Epoch {epoch}: batch {batch_idx}/{len(train_loader)} ({batch_pct:.1f}%) done"
                )

        avg_train_loss = total_loss / train_size

        # Validation phase
        model.eval()
        val_loss, correct = 0.0, 0
        with torch.no_grad():
            for xb, yb in val_loader:
                xb, yb = xb.to(device), yb.to(device)
                logits = model(xb.view(xb.size(0), 2, 6, 7))
                loss = criterion(logits, yb)
                val_loss += loss.item() * xb.size(0)
                preds = logits.argmax(dim=1)
                correct += (preds == yb).sum().item()

        avg_val_loss = val_loss / val_size
        val_acc = correct / val_size

        logging.info(
            f"Epoch {epoch}/{config.epochs} complete: "
            f"Train Loss {avg_train_loss:.4f}, "
            f"Val Loss {avg_val_loss:.4f}, "
            f"Val Acc {val_acc:.4f}"
        )

        # Checkpointing
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            ckpt_path = os.path.join(config.model_dir, "best_policy_net.pt")
            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                    "epoch": epoch,
                    "val_loss": avg_val_loss,
                },
                ckpt_path,
            )
            logging.info(f"New best model at epoch {epoch}, saved to {ckpt_path}")
        else:
            logging.info(
                f"Epoch {epoch}: no improvement (best val_loss {best_val_loss:.4f})"
            )

        scheduler.step(avg_val_loss)

    writer.close()
    logging.info(
        f"Training complete. Best model saved to {os.path.join(config.model_dir, 'best_policy_net.pt')}."
    )


# -----------------------------------------------------------------------------
# CLI & Entry
# -----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Train Connect4 Policy Network")
    parser.add_argument("--data_path", type=str, default="../data/train.json")
    parser.add_argument("--model_dir", type=str, default="../models")
    parser.add_argument("--log_dir", type=str, default="../logs")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch_size", type=int, default=128)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--val_split", type=float, default=0.1)
    parser.add_argument("--patience", type=int, default=5)
    args = parser.parse_args()

    os.makedirs(args.model_dir, exist_ok=True)
    os.makedirs(args.log_dir, exist_ok=True)
    setup_logging(os.path.join(args.log_dir, "training.log"))

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logging.info(f"Using device: {device}")

    base_dir = os.path.dirname(__file__)
    full_path = os.path.join(base_dir, "..", args.data_path)
    dataset = load_data(full_path)

    model = Connect4PolicyNet().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=args.lr)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=args.patience, verbose=True
    )

    class Config:
        pass

    config = Config()
    for k, v in vars(args).items():
        setattr(config, k, v)

    train(dataset, model, criterion, optimizer, scheduler, device, config)


if __name__ == "__main__":
    main()
