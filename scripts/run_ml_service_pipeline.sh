#!/usr/bin/env bash
set -euo pipefail

# ----------------------------------------------------------------------------
# Continuous Learning Pipeline Script
# Bootstraps baseline, ingests new games, fine-tunes, evaluates, and promotes.
# ----------------------------------------------------------------------------

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
}

# figure out directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$SCRIPT_DIR"

log "Starting continuous learning pipeline"

# Step 0: Bootstrap current model
log "Ensuring root-level models directory exists"
mkdir -p "$ROOT/models"
BASELINE_CKPT="$ROOT/models/best_policy_net.pt"
if [[ ! -s "$BASELINE_CKPT" ]]; then
  log "ERROR: Missing baseline checkpoint at $BASELINE_CKPT"
  exit 1
fi
log "Bootstrapping current model"
cp "$BASELINE_CKPT" "$ROOT/models/current_policy_net.pt"

# Stage 1: Ingest new human/AI games
log "Stage 1: Ingesting new human/AI games"
python3 "$ROOT/scripts/ingest_and_buffer.py" \
  --live-log "$ROOT/ml_service/data/live_games.jsonl" \
  --buffer    "$ROOT/ml_service/data/replay_buffer.pkl" \
  --max-size  1000
log "Stage 1 complete"

# Stage 2: Fine-tune model
TS=$(date -u +"%Y%m%dT%H%M%SZ")
FINE_TUNED="$ROOT/models/fine_tuned_${TS}.pt"
log "Stage 2: Fine-tuning model (output: $(basename "$FINE_TUNED"))"
python3 "$ROOT/scripts/fine_tune.py" \
  --base-model "$ROOT/models/current_policy_net.pt" \
  --buffer     "$ROOT/ml_service/data/replay_buffer.pkl" \
  --output     "$FINE_TUNED" \
  --epochs     3 \
  --batch-size 64 \
  --lr         1e-4 \
  --historic   0.8
if [[ ! -s "$FINE_TUNED" ]]; then
  log "No fine-tuned model produced; copying current model"
  cp "$ROOT/models/current_policy_net.pt" "$FINE_TUNED"
fi
log "Stage 2 complete"

# Stage 3: Evaluate new model vs current
log "Stage 3: Evaluating new model against current"
python3 "$ROOT/scripts/evaluate_new_model.py" \
  --new   "$FINE_TUNED" \
  --old   "$ROOT/models/current_policy_net.pt" \
  --games 50 \
  --output "$ROOT/ml_service/data/eval_report.json"
log "Stage 3 complete"

# Stage 4: Promote if performance threshold met
log "Stage 4: Promoting new model if meets threshold"
python3 "$ROOT/scripts/promote_if_good.py" \
  --report      "$ROOT/ml_service/data/eval_report.json" \
  --new         "$FINE_TUNED" \
  --prod-target "$ROOT/models/current_policy_net.pt" \
  --threshold   0.52
log "Stage 4 complete"

log "Continuous learning pipeline completed successfully"
