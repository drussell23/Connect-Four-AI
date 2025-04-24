#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"; }

# ─── resolve this script’s directory ───────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT"

log "=== OFFLINE PIPELINE ==="

# Step 1: Generate self-play data
log "Step 1: Generating raw self-play games"
npx ts-node backend/src/ml/scripts/generate_game_data.ts

# Step 2: Preprocess
log "Step 2: Preprocessing data"
python3 backend/src/ml/scripts/preprocess.py

# Step 3: Sanity check
log "Step 3: Verifying data files"
ls -lh backend/src/ml/data/raw_games.json \
       backend/src/ml/data/train.json \
       backend/src/ml/data/test.json

# Step 4: Train policy net
log "Step 4: Training policy network"
python3 backend/src/ml/scripts/train_policy.py \
  --train-json backend/src/ml/data/train.json \
  --test-data  backend/src/ml/data/test.json \
  --epochs     50 \
  --batch-size 128

# (Optional) Step 5: Serve API for human vs AI logs
log "Step 5: Starting inference server"
cd ml_service
uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000
