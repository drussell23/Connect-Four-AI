#!/usr/bin/env bash
set -euo pipefail

# ----------------------------------------------------------------------------
# Offline Training & Server Launch Script
# Generates self-play data, preprocesses it, trains a policy network,
# and then (optionally) starts the FastAPI model server.
# ----------------------------------------------------------------------------

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
}

countdown() {
  for ((i=3; i>0; i--)); do
    log "⟳ Continuing in ${i}..."
    sleep 1
  done
}

# figure out directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT"

# Step 1: Generate raw self-play games
log "Step 1: Generating raw self-play games"
npx ts-node backend/src/ml/scripts/generate_game_data.ts
log "Step 1 complete"
countdown

# Step 2: Preprocess data into train/test splits
log "Step 2: Preprocessing data for training and evaluation"
python3 backend/src/ml/scripts/preprocess.py
log "Step 2 complete"
countdown

# Step 3: Sanity check generated files
log "Step 3: Verifying generated data files"
ls -lh backend/src/ml/data/raw_games.json backend/src/ml/data/train.json backend/src/ml/data/test.json
log "Step 3 complete"
countdown

# Step 4: Train policy network offline
log "Step 4: Training policy network (epochs=50, batch_size=128)"
python3 backend/src/ml/scripts/train_policy.py \
  --train-json backend/src/ml/data/train.json \
  --test-data backend/src/ml/data/test.json \
  --epochs 50 \
  --batch-size 128
log "Step 4 complete"
countdown

# Step 5: Launch FastAPI inference service
log "Step 5: Starting FastAPI server via Uvicorn on port 8000"
cd ml_service
uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000
