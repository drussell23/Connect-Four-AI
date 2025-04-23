import sys, os  
from fastapi import FastAPI  
from pydantic import BaseModel 
import torch 

ML_ROOT = os.path.dirname(__file__)
sys.path.append(os.path.join(ML_ROOT, "src"))
from src.policy_net import Connect4PolicyNet

# Paths
def model_paths():
    root = ML_ROOT
    return {
        'model_dir': os.path.join(root, 'models'),
        'ckpt': os.path.join(root, 'models', 'best_policy_net.pt'),
        'ts_model': os.path.join(root, 'models', 'policy_net_ts.pt'),
        'onnx_model': os.path.join(root, 'models', 'policy_net.onnx')
    }

paths = model_paths()

# Device
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# Load model
model = Connect4PolicyNet().to(device)
checkpoint = torch.load(paths['ckpt'], map_location=device)
# handle raw or wrapped state dict
state = checkpoint['model_state_dict'] if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint else checkpoint
model.load_state_dict(state)
model.eval()

# FastAPI app
app = FastAPI(title='Connect4 AI Prediction Service')

class BoardIn(BaseModel):
    board: list[list[str]]  # 6x7 of "Empty" | "Red" | "Yellow"

@app.post('/predict')
def predict(payload: BoardIn):
    """Predicts the best Connect4 move given a 6x7 board."""
    # map strings to floats
    mapping = {'Empty': 0.0, 'Red': 1.0, 'Yellow': -1.0}
    numeric = [[mapping[cell] for cell in row] for row in payload.board]
    # create 2-channel masks
    red_mask = [[1.0 if v == 1.0 else 0.0 for v in row] for row in numeric]
    yellow_mask = [[1.0 if v == -1.0 else 0.0 for v in row] for row in numeric]
    tensor = torch.tensor([red_mask, yellow_mask], dtype=torch.float32, device=device).unsqueeze(0)

    # inference
    with torch.no_grad():
        logits = model(tensor)  # [1,7]
        probs = torch.softmax(logits, dim=1)[0]  # [7]
        move = int(torch.argmax(probs).item())

    return {'move': move, 'probs': probs.cpu().tolist()}

# Run with:
# cd backend/src/ml
# uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000
