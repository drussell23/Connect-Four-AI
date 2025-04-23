import os  
import json  
import random 
import argparse  
import logging 
import torch  
import torch.nn as nn  
import torch.optim as optim  
from torch.utils.data import TensorDataset, DataLoader, random_split 
from torch.utils.tensorboard import SummaryWriter  
from policy_net import Connect4PolicyNet 

# Set random seeds for reproducibility
SEED = 42
random.seed(SEED)
torch.manual_seed(SEED)

# Configure logging
def setup_logging(log_file: str):
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s %(levelname)s: %(message)s',
        handlers=[logging.FileHandler(log_file), logging.StreamHandler()]
    )


def load_data(data_path: str):
    with open(data_path, 'r') as f:
        raw = json.load(f)
    boards, moves = [], []
    for ex in raw:
        flat = [ {'Empty':0, 'Red':1, 'Yellow':-1}[c]
                 for row in ex['board'] for c in row ]
        boards.append(flat)
        moves.append(ex['move'])
    X = torch.tensor(boards, dtype=torch.float32)
    y = torch.tensor(moves, dtype=torch.long)
    return TensorDataset(X, y)


def train(
    dataset,
    model,
    criterion,
    optimizer,
    scheduler,
    device,
    config
):
    # Split data
    val_size = int(len(dataset) * config.val_split)
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_ds, batch_size=config.batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=config.batch_size)

    writer = SummaryWriter(log_dir=config.log_dir)
    best_val_loss = float('inf')

    for epoch in range(1, config.epochs + 1):
        model.train()
        total_loss = 0.0
        for xb, yb in train_loader:
            xb, yb = xb.to(device), yb.to(device)
            optimizer.zero_grad()
            logits = model(xb.view(xb.size(0), 2, 6, 7))
            loss = criterion(logits, yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * xb.size(0)
        avg_train_loss = total_loss / train_size

        # Validation
        model.eval()
        val_loss = 0.0
        correct = 0
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
            f"Epoch {epoch}/{config.epochs} "
            f"Train Loss: {avg_train_loss:.4f} "
            f"Val Loss: {avg_val_loss:.4f} "
            f"Val Acc: {val_acc:.4f}"
        )
        writer.add_scalar('Loss/train', avg_train_loss, epoch)
        writer.add_scalar('Loss/val', avg_val_loss, epoch)
        writer.add_scalar('Accuracy/val', val_acc, epoch)

        # Checkpoint
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            ckpt_path = os.path.join(config.model_dir, 'best_policy_net.pt')
            torch.save({
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'epoch': epoch,
                'val_loss': avg_val_loss
            }, ckpt_path)
            logging.info(f"Saved best model to {ckpt_path}")
        scheduler.step(avg_val_loss)

    writer.close()


def main():
    parser = argparse.ArgumentParser(description='Train Connect4 Policy Network')
    parser.add_argument('--data_path', type=str, default='../data/train.json')
    parser.add_argument('--model_dir', type=str, default='../models')
    parser.add_argument('--log_dir', type=str, default='../logs')
    parser.add_argument('--epochs', type=int, default=50)
    parser.add_argument('--batch_size', type=int, default=128)
    parser.add_argument('--lr', type=float, default=1e-3)
    parser.add_argument('--val_split', type=float, default=0.1)
    parser.add_argument('--patience', type=int, default=5)
    args = parser.parse_args()

    os.makedirs(args.model_dir, exist_ok=True)
    os.makedirs(args.log_dir, exist_ok=True)
    setup_logging(os.path.join(args.log_dir, 'training.log'))

    # Device
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    logging.info(f"Using device: {device}")

    # Load data
    dataset = load_data(os.path.join(os.path.dirname(__file__), '..', args.data_path))

    # Model, criterion, optimizer, scheduler
    model = Connect4PolicyNet().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=args.lr)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=args.patience, verbose=True
    )

    # Train
    class Config: pass
    config = Config()
    for k, v in vars(args).items(): setattr(config, k, v)

    train(dataset, model, criterion, optimizer, scheduler, device, config)


if __name__ == '__main__':
    main()
