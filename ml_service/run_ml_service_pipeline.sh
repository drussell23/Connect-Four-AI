#!/usr/bin/env bash
set -euo pipefail

# ----------------------------------------------------------------------------
# Continuous Learning Pipeline Script
# This script bootstraps a baseline model, ingests new game data,
# fine-tunes the model, evaluates performance, and promotes if better.
# ----------------------------------------------------------------------------

# Logging function for uniform, timestamped output
log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*"
}

log "Starting continuous learning pipeline"

# Change to the script's directory for relative paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ----------------------------------------------------------------------------
# 0) Bootstrap baseline model from backend
# ----------------------------------------------------------------------------
log "Ensuring root-level models directory exists"
mkdir -p ../models

BACKEND_CKPT=../backend/src/ml/models/policy_net.pt
if [[ ! -f "$BACKEND_CKPT" ]]; then
  log "ERROR: Missing baseline checkpoint at $BACKEND_CKPT"
  exit 1
fi

log "Copying baseline checkpoint into models/"
cp "$BACKEND_CKPT" ../models/best_policy_net.pt
cp "$BACKEND_CKPT" ../models/current_policy_net.pt

# ----------------------------------------------------------------------------
# 1) Ingest new human/AI games into replay buffer
# ----------------------------------------------------------------------------
log "Stage 1: Ingesting new human/AI games"
python3 scripts/ingest_and_buffer.py \
  --live-log data/live_games.jsonl \
  --buffer    data/replay_buffer.pkl \
  --max-size  1000
log "Stage 1 complete"

# ----------------------------------------------------------------------------
# 2) Fine-tune model on mixed historic + live data
# ----------------------------------------------------------------------------
TS=$(date -u +"%Y%m%dT%H%M%SZ")
log "Stage 2: Fine-tuning model (output: fine_tuned_${TS}.pt)"
python3 scripts/fine_tune.py \
  --base-model ../models/current_policy_net.pt \
  --buffer     data/replay_buffer.pkl \
  --output     ../models/fine_tuned_${TS}.pt \
  --epochs     3 \
  --batch-size 64 \
  --lr         1e-4 \
  --historic   0.8
log "Stage 2 complete: Saved ../models/fine_tuned_${TS}.pt"

# ----------------------------------------------------------------------------
# 3) Evaluate new model vs current
# ----------------------------------------------------------------------------
log "Stage 3: Evaluating new model against current"
python3 scripts/evaluate_new_model.py \
  --new   ../models/fine_tuned_${TS}.pt \
  --old   ../models/current_policy_net.pt \
  --games 50 \
  --output data/eval_report.json
log "Stage 3 complete: Results in data/eval_report.json"

# ----------------------------------------------------------------------------
# 4) Promote new model if performance threshold is met
# ----------------------------------------------------------------------------
log "Stage 4: Promoting new model if meets threshold"
python3 scripts/promote_if_good.py \
  --report      data/eval_report.json \
  --new         ../models/fine_tuned_${TS}.pt \
  --prod-target ../models/current_policy_net.pt \
  --threshold   0.52
log "Stage 4 complete"

log "Continuous learning pipeline completed successfully"

