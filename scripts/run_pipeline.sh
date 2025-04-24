#!/usr/bin/env bash
set -euo pipefail

# ----------------------------------------------------------------------------
# Unified ML Pipeline
# Usage: ./run_pipeline.sh [offline|continuous|both] [--serve]
#   offline    : run offline self-play → preprocess → train
#   continuous : run continuous ingest → fine-tune → eval → promote
#   both       : run offline then continuous (default)
#   --serve    : after pipeline, start FastAPI inference server
# ----------------------------------------------------------------------------

# Logging helper
log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
}

# Resolve directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

# Parse arguments
MODE="${1:-both}"; shift || true
SERVE=false
if [[ "${1:-}" == "--serve" ]]; then
  SERVE=true
fi

# Paths to pipeline scripts
OFFLINE="$ROOT/scripts/run_ml_pipeline.sh"
CONTINUOUS="$ROOT/scripts/run_ml_service_pipeline.sh"

# Execute offline flow
if [[ "$MODE" == "offline" || "$MODE" == "both" ]]; then
  log "=== OFFLINE PIPELINE ==="
  bash "$OFFLINE"
fi

# Execute continuous flow
if [[ "$MODE" == "continuous" || "$MODE" == "both" ]]; then
  log "=== CONTINUOUS PIPELINE ==="
  bash "$CONTINUOUS"
fi

# Optionally serve the inference API
if [[ "$SERVE" == "true" ]]; then
  log "=== STARTING INFERENCE SERVER ==="
  cd "$ROOT/ml_service"
  uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000
fi
