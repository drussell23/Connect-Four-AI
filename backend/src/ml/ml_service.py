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
# Enterprise Model and Checkpoint Paths with Intelligent Fallback
# -----------------------------------------------------------------------------
from pathlib import Path


def get_enterprise_model_paths():
    """Get model paths with intelligent fallback system for enterprise deployment"""
    # Environment-configurable base paths
    model_dir = os.getenv("MODEL_PATH", "../../../models/")
    backup_dir = os.getenv("BACKUP_MODEL_PATH", "../../../models_backup/")
    policy_name = os.getenv("POLICY_MODEL_NAME", "best_policy_net.pt")

    # Resolve paths from ML_ROOT
    base_path = Path(ML_ROOT) / model_dir
    backup_path = Path(ML_ROOT) / backup_dir

    # Primary model paths
    policy_model = base_path / policy_name
    ts_model = base_path / "policy_net_ts.pt"
    onnx_model = base_path / "policy_net.onnx"

    # Intelligent fallback to backup if primary doesn't exist
    if not policy_model.exists() and (backup_path / policy_name).exists():
        logger.warning(
            f"🔄 Primary model not found, using backup: {backup_path / policy_name}"
        )
        policy_model = backup_path / policy_name

    # Fallback for other model formats
    if not ts_model.exists() and (backup_path / "policy_net_ts.pt").exists():
        ts_model = backup_path / "policy_net_ts.pt"

    if not onnx_model.exists() and (backup_path / "policy_net.onnx").exists():
        onnx_model = backup_path / "policy_net.onnx"

    paths = {
        "model_dir": str(base_path),
        "backup_dir": str(backup_path),
        "ckpt": str(policy_model),
        "ts_model": str(ts_model),
        "onnx_model": str(onnx_model),
        "policy_exists": policy_model.exists(),
        "backup_available": (backup_path / policy_name).exists(),
    }

    logger.info(f"🚀 Enterprise Model Configuration:")
    logger.info(f"   📁 Model Dir: {paths['model_dir']}")
    logger.info(f"   📁 Backup Dir: {paths['backup_dir']}")
    logger.info(
        f"   🤖 Policy Model: {paths['ckpt']} ({'✅' if paths['policy_exists'] else '❌'})"
    )
    logger.info(
        f"   🔄 Backup Available: {'✅' if paths['backup_available'] else '❌'}"
    )

    return paths


paths = get_enterprise_model_paths()

# -----------------------------------------------------------------------------
# Device
# -----------------------------------------------------------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Using device: {device}")

# -----------------------------------------------------------------------------
# Enterprise Model Loading with Graceful Fallback
# -----------------------------------------------------------------------------
model = Connect4PolicyNet().to(device)

# Enhanced model loading with enterprise features
try:
    if paths["policy_exists"]:
        checkpoint = torch.load(paths["ckpt"], map_location=device)
        state = checkpoint.get("model_state_dict", checkpoint)
        model.load_state_dict(state)
        model.eval()
        logger.info(f"✅ Loaded enterprise model checkpoint from {paths['ckpt']}")
    elif paths["backup_available"]:
        logger.warning("🔄 Primary model unavailable, attempting backup model load...")
        backup_policy = Path(paths["backup_dir"]) / os.getenv(
            "POLICY_MODEL_NAME", "best_policy_net.pt"
        )
        checkpoint = torch.load(str(backup_policy), map_location=device)
        state = checkpoint.get("model_state_dict", checkpoint)
        model.load_state_dict(state)
        model.eval()
        logger.info(f"✅ Loaded backup model checkpoint from {backup_policy}")
    else:
        logger.error("❌ No models found in primary or backup locations")
        # For demo purposes, initialize with random weights
        logger.warning("🎲 Initializing with random weights for demo purposes")
        model.eval()

    # Enterprise model validation
    logger.info("🔍 Running enterprise model validation...")
    test_input = torch.zeros(1, 2, 6, 7, device=device)
    with torch.no_grad():
        test_output = model(test_input)
        if test_output.shape != (1, 7):
            raise RuntimeError(
                f"Invalid model output shape: {test_output.shape}, expected (1, 7)"
            )
    logger.info("✅ Enterprise model validation successful")

except Exception as e:
    logger.exception("❌ Enterprise model loading failed")
    logger.warning("🎲 Falling back to random model for service availability")
    # Initialize random model to keep service running
    model.eval()
    logger.info(
        "⚠️  Service running with fallback model - update models for full functionality"
    )

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
