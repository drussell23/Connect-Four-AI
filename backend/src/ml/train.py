# pyright: reportMissingImports=false
# pylance: reportMissingImports=false
import os
import argparse
import numpy as np  # type: ignore
import torch  # type: ignore  # noqa: F401
import torch.nn as nn  # type: ignore  # noqa: F401
import torch.optim as optim  # type: ignore  # noqa: F401
from torch.utils.data import Dataset, DataLoader  # type: ignore  # noqa: F401


class Connect4Dataset(Dataset):
    """
    Supervised dataset for Connect Four policy learning.
    Expects features in X.npy (shape: [N, 42])
    and labels in y.npy (shape: [N], values in [0..6]).
    """
    def __init__(self, data_dir: str):
        x_path = os.path.join(data_dir, 'X.npy')
        y_path = os.path.join(data_dir, 'y.npy')
        self.X = np.load(x_path).astype(np.float32)
        self.y = np.load(y_path).astype(np.int64)
        assert self.X.shape[0] == self.y.shape[0], "X and y must have same first dimension"

    def __len__(self) -> int:
        return len(self.y)

    def __getitem__(self, idx: int):
        return self.X[idx], self.y[idx]


class PolicyNet(nn.Module):
    """
    Simple feed-forward policy network.
    Input: flattened board (42 dims)
    Output: logits for 7 columns
    """
    def __init__(self) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(42, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 7)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def train(args) -> None:
    # dataset and dataloader
    dataset = Connect4Dataset(args.data_dir)
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True)

    # model, loss, optimizer
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = PolicyNet().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=args.lr)

    # training loop
    for epoch in range(1, args.epochs + 1):
        model.train()
        total_loss = 0.0
        for X_batch, y_batch in loader:
            X_batch = X_batch.to(device)
            y_batch = y_batch.to(device)

            optimizer.zero_grad()
            logits = model(X_batch)
            loss = criterion(logits, y_batch)
            loss.backward()
            optimizer.step()

            total_loss += loss.item() * X_batch.size(0)

        avg_loss = total_loss / len(dataset)
        print(f"Epoch {epoch}/{args.epochs} - Loss: {avg_loss:.4f}")

    # save the trained model
    os.makedirs(args.model_dir, exist_ok=True)
    model_path = os.path.join(args.model_dir, 'policy_net.pth')
    torch.save(model.state_dict(), model_path)
    print(f"Model saved to {model_path}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Train Connect Four policy network")
    parser.add_argument(
        '--data-dir', type=str, default='ml/data/processed',
        help='Directory containing X.npy and y.npy'
    )
    parser.add_argument(
        '--model-dir', type=str, default='ml/models',
        help='Directory to save trained model'
    )
    parser.add_argument(
        '--epochs', type=int, default=20,
        help='Number of training epochs'
    )
    parser.add_argument(
        '--batch-size', type=int, default=64,
        help='Batch size for training'
    )
    parser.add_argument(
        '--lr', type=float, default=1e-3,
        help='Learning rate for Adam optimizer'
    )
    args = parser.parse_args()
    train(args)
