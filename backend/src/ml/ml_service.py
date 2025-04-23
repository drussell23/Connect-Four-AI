import sys
import os
import logging
from fastapi import FastAPI, Request
from pydantic import BaseModel
import torch

# -----------------------------------------------------------------------------
# Logging setup
# -----------------------------------------------------------------------------
LOG_LEVEL = logging.INFO
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s %(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            os.path.join(os.path.dirname(__file__), "..", "logs", "ml_service.log")
        ),
    ],
)
logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# Import model definition
# -----------------------------------------------------------------------------
ML_ROOT = os.path.dirname(__file__)
sys.path.append(os.path.join(ML_ROOT, "src"))
from src.policy_net import Connect4PolicyNet


# -----------------------------------------------------------------------------
# Model and checkpoint paths
# -----------------------------------------------------------------------------
def model_paths():
    root = ML_ROOT
    paths = {
        "model_dir": os.path.normpath(os.path.join(root, "..", "models")),
        "ckpt": os.path.normpath(
            os.path.join(root, "..", "models", "best_policy_net.pt")
        ),
        "ts_model": os.path.normpath(
            os.path.join(root, "..", "models", "policy_net_ts.pt")
        ),
        "onnx_model": os.path.normpath(
            os.path.join(root, "..", "models", "policy_net.onnx")
        ),
    }
    logger.info(f"Model paths: {paths}")
    return paths


paths = model_paths()

# -----------------------------------------------------------------------------
# Device
# -----------------------------------------------------------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Using device: {device}")

# -----------------------------------------------------------------------------
# Load model checkpoint
# -----------------------------------------------------------------------------
model = Connect4PolicyNet().to(device)
try:
    checkpoint = torch.load(paths["ckpt"], map_location=device)
    state = checkpoint.get("model_state_dict", checkpoint)
    model.load_state_dict(state)
    model.eval()
    logger.info(f"Loaded model checkpoint from {paths['ckpt']}")
except Exception as e:
    logger.error(f"Failed to load model checkpoint: {e}")
    raise

# -----------------------------------------------------------------------------
# FastAPI app
# -----------------------------------------------------------------------------
app = FastAPI(title="Connect4 AI Prediction Service")

# Pydantic model for request
typing_board = list[list[str]]


class BoardIn(BaseModel):
    board: typing_board  # 6x7 grid of 'Empty'|'Red'|'Yellow'


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response


@app.post("/predict")
def predict(payload: BoardIn):
    """Predict the best Connect4 move for a given board."""
    logger.info(f"Payload received: {payload.board}")
    mapping = {"Empty": 0.0, "Red": 1.0, "Yellow": -1.0}
    numeric = [[mapping[cell] for cell in row] for row in payload.board]
    logger.debug(f"Numeric board: {numeric}")

    # build 2-channel mask
    red_mask = [[1.0 if v == 1.0 else 0.0 for v in row] for row in numeric]
    yellow_mask = [[1.0 if v == -1.0 else 0.0 for v in row] for row in numeric]
    tensor = torch.tensor(
        [red_mask, yellow_mask], dtype=torch.float32, device=device
    ).unsqueeze(0)
    logger.debug(f"Input tensor shape: {tensor.shape}")

    with torch.no_grad():
        logits = model(tensor)  # shape [1,7]
        probs = torch.softmax(logits, dim=1)[0].cpu().tolist()
        move = int(torch.argmax(torch.tensor(probs)).item())
    logger.info(f"Predicted move: {move}, probabilities: {probs}")

    return {"move": move, "probs": probs}


# -----------------------------------------------------------------------------
# Usage instructions
# -----------------------------------------------------------------------------
# Run from backend/src/ml:
# uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000
