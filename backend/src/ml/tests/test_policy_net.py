import argparse
import sys
from pathlib import Path

import torch
from torch.utils.data import TensorDataset, DataLoader

# Add local src folder to sys.path to import policy_net
ML_ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(ML_ROOT / 'src'))
from policy_net import Connect4PolicyNet  # type: ignore


def find_file(filename: str) -> Path:
    cwd = Path.cwd()
    for ancestor in [cwd] + list(cwd.parents):
        candidate = ancestor / 'backend' / 'src' / 'ml' / 'data' / filename
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(f"Could not locate {filename} under any ancestor directory")


def load_checkpoint(path: Path, device: torch.device):
    if not path.is_file():
        raise FileNotFoundError(f"Checkpoint not found: {path}")
    checkpoint = torch.load(path, map_location=device)
    state = checkpoint.get('model_state_dict', checkpoint)
    return state


def main():
    parser = argparse.ArgumentParser(description="Test Connect4 policy network accuracy")
    parser.add_argument('-m', '--model', type=Path,
                        help="Path to policy network checkpoint (.pt) file")
    parser.add_argument('-t', '--test-data', type=Path,
                        help="Path to test_data.pt file containing 'data' and 'labels' tensors")
    parser.add_argument('-b', '--batch-size', type=int, default=64,
                        help="Batch size for inference")
    args = parser.parse_args()

    # Locate model checkpoint
    if args.model:
        model_path = args.model
    else:
        try:
            model_path = find_file('best_policy_net.pt')
        except FileNotFoundError as e:
            sys.stderr.write(str(e) + "\n")
            sys.exit(1)

    # Locate test data
    if args.test_data:
        test_path = args.test_data
    else:
        try:
            test_path = find_file('test_data.pt')
        except FileNotFoundError as e:
            sys.stderr.write(str(e) + "\n")
            sys.exit(1)

    # Device
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    # Load model
    model = Connect4PolicyNet().to(device)
    state_dict = load_checkpoint(model_path, device)
    model.load_state_dict(state_dict)
    model.eval()

    # Load test data
    checkpoint = torch.load(test_path, map_location=device)
    data_tensor = checkpoint['data']  # shape: [N,2,6,7]
    labels = checkpoint['labels']     # shape: [N]

    dataset = TensorDataset(data_tensor, labels)
    loader = DataLoader(dataset, batch_size=args.batch_size)

    # Inference
    correct = 0
    total = 0
    with torch.no_grad():
        for batch_data, batch_labels in loader:
            batch_data = batch_data.to(device)
            logits = model(batch_data)  # [B,7]
            preds = logits.argmax(dim=1).cpu()
            correct += (preds == batch_labels).sum().item()
            total += batch_labels.size(0)

    accuracy = correct / total * 100
    print(f"Test Accuracy: {accuracy:.2f}% ({correct}/{total})")


if __name__ == '__main__':
    main()
