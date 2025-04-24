import sys
import os
import logging
from typing import List, Union
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError
import torch

# -----------------------------------------------------------------------------
# Logging setup
# -----------------------------------------------------------------------------
LOG_LEVEL = logging.INFO
base_dir = os.path.dirname(__file__)
logs_dir = os.path.join(base_dir, "logs")
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
# Model import setup
# -----------------------------------------------------------------------------
sys.path.insert(0, os.path.join(base_dir, "src"))
from policy_net import Connect4PolicyNet  # type: ignore
from schemas.game_log import GameLog

# -----------------------------------------------------------------------------
# Model and checkpoint paths
# -----------------------------------------------------------------------------
def model_paths():
    root = base_dir
    return {
        "model_dir": os.path.normpath(os.path.join(root, "..", "models")),
        "ckpt": os.path.normpath(os.path.join(root, "..", "models", "best_policy_net.pt")),
        "ts_model": os.path.normpath(os.path.join(root, "..", "models", "policy_net_ts.pt")),
        "onnx_model": os.path.normpath(os.path.join(root, "..", "models", "policy_net.onnx")),
    }

paths = model_paths()
logger.info(f"Model paths: {paths}")

# -----------------------------------------------------------------------------
# Device and model loading
# -----------------------------------------------------------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Using device: {device}")
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
app = FastAPI(title="Connect4 AI Prediction & Logging Service")

# Pydantic schema for inference requests
class BoardIn(BaseModel):
    board: Union[
        List[List[str]],         # 6×7 of 'Empty'|'Red'|'Yellow'
        List[List[List[float]]], # 2×6×7 numeric mask
    ]

# -----------------------------------------------------------------------------
# Middleware for request logging
# -----------------------------------------------------------------------------
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response

# -----------------------------------------------------------------------------
# Inference endpoint
# -----------------------------------------------------------------------------
@app.post("/predict")
async def predict_endpoint(request: Request):
    try:
        payload = await request.json()
        board_in = BoardIn(**payload)
    except (ValidationError, ValueError) as e:
        logger.error(f"Predict payload validation error: {e}")
        return JSONResponse(status_code=422, content={"detail": str(e)})

    b = board_in.board
    # Numeric mask case
    if (
        isinstance(b, list)
        and len(b) == 2
        and all(isinstance(layer, list) and len(layer) == 6 for layer in b)
        and all(isinstance(row, list) and len(row) == 7 for layer in b for row in layer)
    ):
        tensor = torch.tensor(b, dtype=torch.float32, device=device).unsqueeze(0)

    # String board case
    elif (
        isinstance(b, list)
        and len(b) == 6
        and all(isinstance(row, list) and len(row) == 7 for row in b)
    ):
        mapping = {"Empty": 0.0, "Red": 1.0, "Yellow": -1.0}
        numeric = [[mapping.get(cell, 0.0) for cell in row] for row in b]
        red_mask = [[1.0 if v == 1.0 else 0.0 for v in row] for row in numeric]
        yellow_mask = [[1.0 if v == -1.0 else 0.0 for v in row] for row in numeric]
        tensor = torch.tensor([red_mask, yellow_mask], dtype=torch.float32, device=device).unsqueeze(0)

    else:
        msg = f"Invalid board structure: {b}"
        logger.error(msg)
        return JSONResponse(status_code=422, content={"detail": msg})

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

# -----------------------------------------------------------------------------
# Logging endpoint
# -----------------------------------------------------------------------------
@app.post("/log_game")
async def log_game_endpoint(request: Request):
    try:
        payload = await request.json()
        game_log = GameLog(**payload)
    except (ValidationError, ValueError) as e:
        logger.error(f"LogGame payload validation error: {e}")
        return JSONResponse(status_code=422, content={"detail": str(e)})

    try:
        data_dir = os.path.join(base_dir, "data")
        os.makedirs(data_dir, exist_ok=True)
        outfile = os.path.join(data_dir, "live_games.jsonl")
        with open(outfile, "a") as f:
            f.write(game_log.json() + "\n")
        logger.info(f"Logged game: outcome={game_log.outcome}, moves={len(game_log.moves)}")
    except Exception as e:
        logger.exception("Failed to write game log")
        raise HTTPException(status_code=500, detail=str(e))

    return {"status": "logged"}

# -----------------------------------------------------------------------------
# Run instructions
# -----------------------------------------------------------------------------
# cd ml_service
# uvicorn ml_service:app --reload --host 0.0.0.0 --port 8001
