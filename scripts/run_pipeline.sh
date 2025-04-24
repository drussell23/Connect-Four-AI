#!/usr/bin/env bash
set -euo pipefail

# ----------------------------------------------------------------------------
# scripts/run_pipeline.sh
# Hybrid ML pipeline: offline self-play → live logging → continuous learning
# Usage: ./run_pipeline.sh [offline|continuous|both] [--serve] [--interval MINUTES]
# ----------------------------------------------------------------------------

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
}

# resolve this script’s directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

# Default settings
MODE="both"
SERVE=false
INTERVAL=5  # minutes between continuous cycles

# parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    offline|continuous|both)
      MODE="$1"
      shift
      ;;
    --serve)
      SERVE=true
      shift
      ;;
    --interval)
      INTERVAL="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# If serve flag, clean up and start the ML API
if [[ "$SERVE" == true ]]; then
  # Ensure port 8000 is free
  if lsof -ti tcp:8000 >/dev/null; then
    log "Port 8000 in use—killing existing process"
    lsof -ti tcp:8000 | xargs kill -9
  fi

  log "=== STARTING INFERENCE API ==="
  cd "$ROOT/ml_service"
  uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000 &
  API_PID=$!
  cd "$ROOT"
  trap "kill $API_PID" EXIT
fi

# Offline self-play training
if [[ "$MODE" == "offline" || "$MODE" == "both" ]]; then
  log "=== OFFLINE PIPELINE ==="
  bash "$SCRIPT_DIR/run_ml_pipeline.sh"
fi

# Seed buffer with offline games (for hybrid mode)
if [[ "$MODE" == "both" ]]; then
  log "Seeding replay buffer with offline self-play games"
  python3 "$ROOT/ml_service/scripts/ingest_and_buffer.py" \
    --live-log "$ROOT/backend/src/ml/data/raw_games.json" \
    --buffer   "$ROOT/ml_service/data/replay_buffer.pkl" \
    --max-size 1000
fi

# Continuous learning loop
if [[ "$MODE" == "continuous" || "$MODE" == "both" ]]; then
  log "=== STARTING CONTINUOUS LEARNING LOOP (every $INTERVAL minutes) ==="
  while true; do
    log "Running continuous pipeline"
    bash "$SCRIPT_DIR/run_ml_service_pipeline.sh"
    log "Sleeping for $INTERVAL minutes"
    sleep "${INTERVAL}m"
  done
fi

log "=== PIPELINE SETUP COMPLETE ==="
