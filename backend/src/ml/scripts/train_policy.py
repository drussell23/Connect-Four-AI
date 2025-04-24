import argparse
import json
import sys
import logging
from pathlib import Path
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader

# Setup detailed logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# Configure module path
def setup_paths():
    ML_ROOT = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(ML_ROOT))
    return ML_ROOT


ML_ROOT = setup_paths()
from src.policy_net import Connect4PolicyNet  # noqa: E402


def find_file(filename: str) -> Path:
    cwd = Path.cwd()
    for ancestor in [cwd] + list(cwd.parents):
        candidate = ancestor / "backend" / "src" / "ml" / "data" / filename
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(f"Could not locate {filename} under any ancestor directory")


def load_json(path: Path):
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        logger.exception(f"Failed to load JSON from {path}")
        raise


def convert_feature(feat_list):
    arr = np.array(feat_list, dtype=np.int64).reshape(6, 7)
    red = (arr == 1).astype(np.float32)
    yellow = (arr == 2).astype(np.float32)
    return torch.from_numpy(np.stack([red, yellow], axis=0))


def prepare_dataset(json_path: Path):
    examples = load_json(json_path)
    data_list, label_list = [], []
    for ex in examples:
        feat = ex.get("features")
        label = ex.get("label")
        if feat is None or label is None:
            continue
        data_list.append(convert_feature(feat))
        label_list.append(int(label))
    if not data_list:
        raise RuntimeError(f"No valid examples found in {json_path}")
    data = torch.stack(data_list)
    labels = torch.tensor(label_list, dtype=torch.long)
    return TensorDataset(data, labels)


def evaluate(model, loader, device):
    model.eval()
    correct, total = 0, 0
    with torch.no_grad():
        for x, y in loader:
            x, y = x.to(device), y.to(device)
            logits = model(x)
            preds = logits.argmax(dim=1)
            correct += (preds == y).sum().item()
            total += y.size(0)
    return correct / total * 100, correct, total


def main():
    parser = argparse.ArgumentParser(
        description="Supervised policy training for Connect4",
        epilog="""
Examples:
  python train_policy.py --train-json ../data/train.json
  python train_policy.py --train-json ../data/train.json --test-data ../data/test_data.pt --epochs 20 --batch-size 128
""",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--train-json", type=Path, required=True, help="Path to train.json file"
    )
    parser.add_argument(
        "--test-data",
        type=Path,
        help="Path to test_data.pt or .json file for evaluation",
    )
    parser.add_argument(
        "--epochs", type=int, default=10, help="Number of training epochs"
    )
    parser.add_argument("--batch-size", type=int, default=64, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    args = parser.parse_args()

    logger.info(
        f"Starting training: epochs={args.epochs}, batch_size={args.batch_size}, lr={args.lr}"
    )

    # Load training data
    try:
        logger.info(f"Loading training data from {args.train_json}")
        train_ds = prepare_dataset(args.train_json)
    except Exception:
        logger.error("Aborting due to training data load failure.")
        sys.exit(1)
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True)
    logger.info(
        f"Loaded {len(train_ds)} training examples, {len(train_loader)} batches per epoch."
    )

    # Load test data if provided
    test_loader = None
    if args.test_data:
        try:
            logger.info(f"Loading test data from {args.test_data}")
            if args.test_data.suffix == ".json":
                test_ds = prepare_dataset(args.test_data)
            else:
                chk = torch.load(args.test_data, map_location="cpu")
                test_ds = TensorDataset(chk["data"], chk["labels"])
            test_loader = DataLoader(test_ds, batch_size=args.batch_size)
            logger.info(f"Loaded {len(test_ds)} test examples.")
        except Exception:
            logger.exception("Failed to load test data, continuing without evaluation.")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Using device: {device}")
    model = Connect4PolicyNet().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    criterion = nn.CrossEntropyLoss()

    models_dir = ML_ROOT / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    ckpt_path = models_dir / "best_policy_net.pt"
    ts_path = models_dir / "policy_net_ts.pt"
    onnx_path = models_dir / "policy_net.onnx"

    best_acc = 0.0
    total_batches = len(train_loader)
    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = 0.0
        logger.info(f"Epoch {epoch}/{args.epochs} start")
        for idx, (x, y) in enumerate(train_loader, start=1):
            try:
                x, y = x.to(device), y.to(device)
                optimizer.zero_grad()
                logits = model(x)
                loss = criterion(logits, y)
                loss.backward()
                optimizer.step()
                running_loss += loss.item() * y.size(0)
            except Exception:
                logger.exception(f"Error during batch {idx}/{total_batches}")
            if idx % max(1, total_batches // 10) == 0:
                pct = idx / total_batches * 100
                logger.info(f"Epoch {epoch}: {pct:.1f}% complete")
        avg_loss = running_loss / len(train_ds)
        logger.info(f"Epoch {epoch} complete: Avg Loss={avg_loss:.4f}")

        if test_loader:
            acc, correct, total = evaluate(model, test_loader, device)
            logger.info(f"Evaluation accuracy: {acc:.2f}% ({correct}/{total})")
            if acc > best_acc:
                best_acc = acc
                torch.save(model.state_dict(), ckpt_path)
                logger.info(f"New best model saved to {ckpt_path}")
        else:
            torch.save(model.state_dict(), ckpt_path)
            logger.info(f"Checkpoint saved to {ckpt_path}")

    logger.info(f"Training complete. Best test accuracy: {best_acc:.2f}%")

    # Export TorchScript
    try:
        model_cpu = Connect4PolicyNet()
        model_cpu.load_state_dict(torch.load(ckpt_path, map_location="cpu"))
        model_cpu.eval()
        scripted = torch.jit.script(model_cpu)
        scripted.save(ts_path)
        logger.info(f"Saved TorchScript model to {ts_path}")
    except Exception:
        logger.exception("Failed to export TorchScript model.")

    # Export ONNX
    try:
        import onnx

        dummy = torch.randn(1, 2, 6, 7)
        torch.onnx.export(
            model_cpu,
            dummy,
            onnx_path,
            input_names=["input"],
            output_names=["logits"],
            dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
        )
        logger.info(f"Saved ONNX model to {onnx_path}")
    except ModuleNotFoundError:
        logger.warning("Skipping ONNX export (install the 'onnx' package to enable it)")
    except Exception:
        logger.exception("Failed during ONNX export.")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        logger.exception("Unhandled exception in training script.")
        sys.exit(1)
