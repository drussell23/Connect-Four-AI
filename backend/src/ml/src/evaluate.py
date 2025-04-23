import os  
import sys  
import json  
import argparse 
import torch 
import torch.nn as nn  
from torch.utils.data import TensorDataset, DataLoader 

# Ensure local "src" folder is on path for policy_net import
ML_ROOT = os.path.dirname(__file__)
sys.path.append(os.path.join(ML_ROOT, "src"))
from policy_net import Connect4PolicyNet 


def load_dataset(data_path: str):
    """Loads JSON data and returns a TensorDataset of inputs and labels."""
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


def evaluate(
    model: nn.Module,
    dataset: TensorDataset,
    batch_size: int,
    device: torch.device,
    criterion: nn.Module
):
    """Runs evaluation on the dataset and prints loss & accuracy."""
    loader = DataLoader(dataset, batch_size=batch_size)
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0
    with torch.no_grad():
        for xb, yb in loader:
            xb, yb = xb.to(device), yb.to(device)
            # reshape input to match [batch,2,6,7]
            xb = xb.view(xb.size(0), 2, 6, 7)
            logits = model(xb)
            loss = criterion(logits, yb)
            total_loss += loss.item() * xb.size(0)
            preds = torch.argmax(logits, dim=1)
            correct += (preds == yb).sum().item()
            total += xb.size(0)
    avg_loss = total_loss / total
    accuracy = correct / total
    print(f"Evaluation results - Loss: {avg_loss:.4f}, Accuracy: {accuracy:.4f}")


def main():
    parser = argparse.ArgumentParser(description='Evaluate Connect4 policy network')
    parser.add_argument('--model-path', type=str, default=os.path.join(ML_ROOT, 'models', 'best_policy_net.pt'), help='Path to model checkpoint')
    parser.add_argument('--data-path', type=str, default=os.path.join(ML_ROOT, 'data', 'test.json'), help='Path to test JSON data')
    parser.add_argument('--batch-size', type=int, default=64, help='Batch size for evaluation')
    args = parser.parse_args()

    # Device
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    # Load model
    model = Connect4PolicyNet().to(device)
    checkpoint = torch.load(args.model_path, map_location=device)
    state = checkpoint['model_state_dict'] if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint else checkpoint
    model.load_state_dict(state)

    # Load data
    dataset = load_dataset(args.data_path)

    # Loss
    criterion = nn.CrossEntropyLoss()

    # Evaluate
    evaluate(model, dataset, args.batch_size, device, criterion)


if __name__ == '__main__':
    main()
