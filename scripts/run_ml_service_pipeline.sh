# ----------------------------------------------------------------------------
# scripts/run_ml_service_pipeline.sh (Continuous)
# ----------------------------------------------------------------------------
#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"; }

# locate root\ nSCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT"

log "Starting continuous learning pipeline"

# Bootstrap model\ log "Bootstrapping baseline model"
mkdir -p "$ROOT/models"
cp "$ROOT/models/best_policy_net.pt" "$ROOT/models/current_policy_net.pt"

# Stage 1: ingest\ log "Stage 1: Ingesting new games"
python3 ml_service/scripts/ingest_and_buffer.py \
  --live-log ml_service/data/live_games.jsonl \
  --buffer    ml_service/data/replay_buffer.pkl \
  --max-size 1000

# Stage 2: fine-tune\ log "Stage 2: Fine-tuning model"
TS=$(date -u +"%Y%m%dT%H%M%SZ")
OUT="$ROOT/models/fine_tuned_${TS}.pt"
python3 ml_service/scripts/fine_tune.py \
  --base-model $ROOT/models/current_policy_net.pt \
  --buffer     ml_service/data/replay_buffer.pkl \
  --output     $OUT \
  --epochs     3 --batch-size 64 --lr 1e-4 --historic 0.8
# fallback if none
if [[ ! -s "$OUT" ]]; then cp $ROOT/models/current_policy_net.pt "$OUT"; fi

# Stage 3: evaluate\ log "Stage 3: Evaluating new model"
python3 ml_service/scripts/evaluate_new_model.py \
  --new   "$OUT" --old "$ROOT/models/current_policy_net.pt" --games 50 --output ml_service/data/eval_report.json

# Stage 4: promote\ log "Stage 4: Promoting model if threshold met"
python3 ml_service/scripts/promote_if_good.py \
  --report ml_service/data/eval_report.json \
  --new    "$OUT" \
  --prod-target "$ROOT/models/current_policy_net.pt" \
  --threshold 0.52

log "Continuous pipeline completed"
