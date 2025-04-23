import json
import random
import sys 
from pathlib import Path

# --- Configuration ---
# Locate data directory relative to this script
BASE_DIR = Path(__file__).resolve().parent.parent / 'data'
RAW_FILE = BASE_DIR / 'raw_games.json'
TRAIN_FILE = BASE_DIR / 'train.json'
TEST_FILE = BASE_DIR / 'test.json'

# Mapping for board encoding
ENCODE_MAP = {'Empty': 0, 'Red': 1, 'Yellow': 2}
OUTCOME_MAP = {'win': 1, 'draw': 0, 'loss': -1}

def encode_board(board):
    """Flatten a 6x7 board into a 42-length integer list"""
    try: 
        return [ENCODE_MAP[cell] for row in board for cell in row]
    except KeyError as e:
        print(f"Unknown cell value: {e}", file=sys.stderr)
        sys.exit(1)

def load_raw_examples(path):
    if not path.exists():
        print(f"Error: raw_games.json not found at {path}", file=sys.stderr)
        sys.exit(1)
    with open(path, 'r') as f:
        return json.load(f)
    
def preprocess(examples):
    """Convert raw game entries to feature/label/value dicts"""
    processed = []
    for ex in examples:
        features = encode_board(ex['board'])
        label = ex['move']
        value = OUTCOME_MAP.get(ex['outcome'], 0)
        processed.append({'features': features, 'label': label, 'value': value})
    return processed

def split_dataset(dataset, train_frac=0.8):
    random.shuffle(dataset)
    split_idx = int(len(dataset) * train_frac)
    return dataset[:split_idx], dataset[split_idx:]

def write_json(path, data):
    with open(path, 'w') as f:
        json.dump(data, f)
    print(f"Wrote {len(data)} examples to {path}")
    
def main():
    raw = load_raw_examples(RAW_FILE)
    processed = preprocess(raw)
    train, test = split_dataset(processed)
    
    # Ensure output dir exists
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    
    write_json(TRAIN_FILE, train)
    write_json(TEST_FILE, test)
    
    print("Preprocessing complete.")
    
if __name__ == '__main__':
    main()