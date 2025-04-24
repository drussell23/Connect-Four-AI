# ----------------------------------------------------------------------------
# scripts/run_ml_pipeline.sh (Offline)
# ----------------------------------------------------------------------------
#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"; }

# locate root and script dirs\ nSCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT"

# Step 1: Generate self-play data\ nlog "Step 1: Generating raw self-play games"
npx ts-node backend/src/ml/scripts/generate_game_data.ts

# Step 2: Preprocess\ nlog "Step 2: Preprocessing data"
python3 backend/src/ml/scripts/preprocess.py

# Step 3: Sanity check\ nlog "Step 3: Verifying data files"
ls -lh backend/src/ml/data/raw_games.json backend/src/ml/data/train.json backend/src/ml/data/test.json

# Step 4: Train policy net\ nlog "Step 4: Training policy network"
python3 backend/src/ml/scripts/train_policy.py \
  --train-json backend/src/ml/data/train.json \
  --test-data  backend/src/ml/data/test.json \
  --epochs 50 --batch-size 128

# Step 5: Optionally serve API\ nlog "Step 5: Starting inference server"
cd ml_service
uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000