#!/usr/bin/env bash
set -euo pipefail

# ----------------------------------------------------------------------------
# Offline Training & Server Launch Script
# Generates self-play data, preprocesses it, trains a policy network,
# and then starts the FastAPI model server for inference.
# ----------------------------------------------------------------------------

# ----------------------------------------------------------------------------
# Logging helper
# ----------------------------------------------------------------------------
log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
}

# ----------------------------------------------------------------------------
# Countdown helper for pacing
# ----------------------------------------------------------------------------
countdown() {
  for ((i=3; i>0; i--)); do
    log "⟳ Continuing in ${i}..."
    sleep 1
  done
}

# ----------------------------------------------------------------------------
# Step 1: Generate raw self-play games
# ----------------------------------------------------------------------------
log "Step 1: Generating raw self-play games" 
npx ts-node scripts/generate_game_data.ts
log "Step 1 complete: raw_games.json generated"
countdown

# ----------------------------------------------------------------------------
# Step 2: Preprocess data into train/test splits
# ----------------------------------------------------------------------------
log "Step 2: Preprocessing data for training and evaluation"
python scripts/preprocess.py
log "Step 2 complete: data/train.json & data/test.json ready"
countdown

# ----------------------------------------------------------------------------
# Step 3: Quick sanity check of generated files
# ----------------------------------------------------------------------------
log "Step 3: Verifying generated data files"
ls -lh data/raw_games.json data/train.json data/test.json
log "Step 3 complete: data files validated"
countdown

# ----------------------------------------------------------------------------
# Step 4: Train policy network offline
# ----------------------------------------------------------------------------
log "Step 4: Training policy network (epochs=50, batch_size=128)"
python src/train.py \
  --data_path ../data/train.json \
  --model_dir ../models \
  --epochs 50 \
  --batch_size 128
log "Step 4 complete: Model weights saved to ../models"
countdown

# ----------------------------------------------------------------------------
# Step 5: Launch FastAPI inference service
# ----------------------------------------------------------------------------
log "Step 5: Starting FastAPI server via Uvicorn on port 8000"
uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000

