import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch

def find_file(filename: str) -> Path:
    """
    Search upward from cwd for backend/src/ml/data/filename
    """
    cwd = Path.cwd()
    for ancestor in [cwd] + list(cwd.parents):
        candidate = ancestor / 'backend' / 'src' / 'ml' / 'data' / filename
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(f"Could not locate {filename} under any ancestor directory")


def load_json(path: Path):
    with open(path, 'r') as f:
        return json.load(f)


def convert_example(feat_list):
    """
    Convert a list of 42 ints (0=Empty,1=Red,2=Yellow) to a (2,6,7) tensor.
    """
    arr = np.array(feat_list, dtype=np.int64).reshape(6, 7)
    red = (arr == 1).astype(np.float32)
    yellow = (arr == 2).astype(np.float32)
    # Stack into channels
    stacked = np.stack([red, yellow], axis=0)
    return torch.from_numpy(stacked)


def main():
    parser = argparse.ArgumentParser(
        description="Generate PyTorch test dataset for Connect Four"
    )
    parser.add_argument(
        '-i', '--input', type=Path,
        help="Path to test.json with preprocessed examples"
    )
    parser.add_argument(
        '-o', '--output', type=Path,
        default=Path.cwd() / 'backend' / 'src' / 'ml' / 'data' / 'test_data.pt',
        help="Output .pt file path"
    )
    args = parser.parse_args()

    # Locate input if not provided
    if args.input:
        input_path = args.input
    else:
        try:
            input_path = find_file('test.json')
        except FileNotFoundError as e:
            sys.stderr.write(str(e) + "\n")
            sys.exit(1)

    try:
        examples = load_json(input_path)
    except Exception as e:
        sys.stderr.write(f"Failed to load JSON: {e}\n")
        sys.exit(1)

    data_list = []
    label_list = []
    for ex in examples:
        feat = ex.get('features')
        if feat is None:
            continue  # skip malformed
        tensor = convert_example(feat)
        data_list.append(tensor)
        label_list.append(int(ex.get('label', -1)))

    if not data_list:
        sys.stderr.write("No valid examples found.\n")
        sys.exit(1)

    # Stack tensors
    data_tensor = torch.stack(data_list)  # shape [N,2,6,7]
    labels_tensor = torch.tensor(label_list, dtype=torch.int64)

    # Ensure output directory exists
    args.output.parent.mkdir(parents=True, exist_ok=True)

    # Save to .pt
    torch.save({'data': data_tensor, 'labels': labels_tensor}, args.output)
    print(f"Saved test dataset: {args.output} \n  data shape: {data_tensor.shape}\n  labels shape: {labels_tensor.shape}")

if __name__ == '__main__':
    main()