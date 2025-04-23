import os 
import sys 
import json  
import argparse  
import torch  

# Ensure local "src" folder is on path for policy_net import
ML_ROOT = os.path.dirname(__file__)
sys.path.append(os.path.join(ML_ROOT, "src"))
from policy_net import Connect4PolicyNet  


def load_board_from_file(path: str) -> list[list[str]]:
    with open(path, 'r') as f:
        data = json.load(f)
    # Expecting { "board": [["Empty","Red",...], ...] }
    if isinstance(data, dict) and 'board' in data:
        return data['board']
    # Or raw 6x7 list
    return data


def build_input_tensor(board: list[list[str]], device: torch.device) -> torch.Tensor:
    mapping = {'Empty': 0.0, 'Red': 1.0, 'Yellow': -1.0}
    # Convert to numeric 6x7 floats
    numeric = [[mapping[cell] for cell in row] for row in board]
    # Two-channel masks
    red_mask = [[1.0 if v == 1.0 else 0.0 for v in row] for row in numeric]
    yellow_mask = [[1.0 if v == -1.0 else 0.0 for v in row] for row in numeric]
    # Create tensor shape [1,2,6,7]
    tensor = torch.tensor([red_mask, yellow_mask], dtype=torch.float32, device=device)
    return tensor.unsqueeze(0)


def main():
    parser = argparse.ArgumentParser(description='Run inference on Connect4 policy network')
    parser.add_argument('--model-path', type=str, default=os.path.join(ML_ROOT, 'models', 'best_policy_net.pt'), help='Path to the .pt checkpoint')
    parser.add_argument('--board-file', type=str, help='Path to JSON file containing the board (6x7 list or {"board": [...]})')
    args = parser.parse_args()

    if not args.board_file:
        print('Error: --board-file is required', file=sys.stderr)
        sys.exit(1)

    # Load model
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = Connect4PolicyNet().to(device)
    checkpoint = torch.load(args.model_path, map_location=device)
    state = checkpoint['model_state_dict'] if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint else checkpoint
    model.load_state_dict(state)
    model.eval()

    # Load board and build tensor
    board = load_board_from_file(args.board_file)
    input_tensor = build_input_tensor(board, device)

    # Inference
    with torch.no_grad():
        logits = model(input_tensor)[0]                 # shape [7]
        probs = torch.softmax(logits, dim=0).cpu().tolist()
        move = int(torch.argmax(logits).item())

    # Output result
    result = {'move': move, 'probs': probs}
    print(json.dumps(result))


if __name__ == '__main__':
    main()
