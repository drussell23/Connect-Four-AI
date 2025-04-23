import sys
import os
import logging
from typing import List, Union
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
import torch

# -----------------------------------------------------------------------------
# Logging setup
# -----------------------------------------------------------------------------
LOG_LEVEL = logging.INFO
logs_dir = os.path.join(os.path.dirname(__file__), "..", "logs")
os.makedirs(logs_dir, exist_ok=True)
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s %(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(logs_dir, "ml_service.log")),
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
    logger.exception("Failed to load model checkpoint")
    raise RuntimeError(f"Model load error: {e}")

# -----------------------------------------------------------------------------
# FastAPI app
# -----------------------------------------------------------------------------
app = FastAPI(title="Connect4 AI Prediction Service")


# Pydantic model for request
# Accept either 6×7 string boards or 2×6×7 numeric boards
class BoardIn(BaseModel):
    board: Union[
        List[List[str]],  # 6×7 of 'Empty'|'Red'|'Yellow'
        List[List[List[float]]],  # 2×6×7 numeric mask
    ]


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response


@app.post("/predict")
def predict(payload: BoardIn):
    """Predict the best Connect4 move for a given board."""
    b = payload.board
    # Numeric mask format: shape [2][6][7]
    if (
        isinstance(b, list)
        and all(
            isinstance(layer, list)
            and len(layer) == 6
            and all(isinstance(row, list) and len(row) == 7 for row in layer)
            for layer in b
        )
        and len(b) == 2
    ):
        tensor = torch.tensor(b, dtype=torch.float32, device=device).unsqueeze(0)
        logger.debug(f"Received numeric board tensor shape: {tensor.shape}")
    # String-based board format: shape [6][7]
    elif (
        isinstance(b, list)
        and len(b) == 6
        and all(isinstance(row, list) and len(row) == 7 for row in b)
    ):
        mapping = {"Empty": 0.0, "Red": 1.0, "Yellow": -1.0}
        numeric = [[mapping.get(cell, 0.0) for cell in row] for row in b]
        red_mask = [[1.0 if v == 1.0 else 0.0 for v in row] for row in numeric]
        yellow_mask = [[1.0 if v == -1.0 else 0.0 for v in row] for row in numeric]
        tensor = torch.tensor(
            [red_mask, yellow_mask], dtype=torch.float32, device=device
        ).unsqueeze(0)
        logger.debug(f"Converted string board to tensor shape: {tensor.shape}")
    else:
        logger.error(f"Invalid board format: {b}")
        raise HTTPException(
            status_code=422, detail="Board must be 6×7 strings or 2×6×7 numerics"
        )

    # Inference
    try:
        with torch.no_grad():
            logits = model(tensor)
            probs = torch.softmax(logits, dim=1)[0].cpu().tolist()
            move = int(torch.argmax(torch.tensor(probs)).item())
        logger.info(f"Predicted move: {move} with probs: {probs}")
        return {"move": move, "probs": probs}
    except Exception as e:
        logger.exception("Inference failure")
        raise HTTPException(status_code=500, detail=str(e))


# Usage:
# cd backend/src/ml
# uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000
