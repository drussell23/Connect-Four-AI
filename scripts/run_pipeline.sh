#!/usr/bin/env bash
set -euo pipefail

# ----------------------------------------------------------------------------
# scripts/run_pipeline.sh
# Advanced Hybrid ML Pipeline: offline self-play → live logging → continuous learning
# Usage: ./run_pipeline.sh [offline|continuous|both] [--serve] [--interval MINUTES] [--port PORT] [--help]
# ----------------------------------------------------------------------------

# ANSI color codes for log levels 33[0m
RED="\033[1;31m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
BLUE="\033[1;34m"
RESET="\033[0m"

# Global variables
MODE="both"
SERVE=false
INTERVAL=1        # minutes between continuous cycles
PORT=8000         # default inference port
LOG_FILE=""     # optional log file

# Print usage information
usage() {
  cat <<EOF
Usage: 
  $0 [offline|continuous|both] [--serve] [--interval MINUTES] [--port PORT] [--log-file FILE] [--help]

Options:
  offline             Run offline self-play only
  continuous          Run continuous learning loop only
  both                Run both offline and continuous (default)
  --serve             Start the inference API server
  --interval MIN      Minutes between continuous cycles (default: 1)
  --port PORT         Port for inference API (default: 8000)
  --log-file FILE     Path to write logs to (also outputs to stdout)
  -h, --help          Show this help message and exit
EOF
  exit 1
}

# Enhanced logging function (to console and optional file)
log() {
  local level="$1"; shift
  local msg="$*"
  local timestamp="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  local color var
  case "$level" in
    INFO) color="$GREEN";;
    WARN) color="$YELLOW";;
    ERROR) color="$RED";;
    DEBUG) color="$BLUE";;
    *) color="$RESET";;
  esac
  printf "%b[%s] [%s] %s%b\n" "$color" "$timestamp" "$level" "$msg" "$RESET"
  if [[ -n "$LOG_FILE" ]]; then
    printf "[%s] [%s] %s\n" "$timestamp" "$level" "$msg" >>"$LOG_FILE"
  fi
}

# Error handler with line number
handle_error() {
  local lineno="$1"
  log ERROR "Error at line ${lineno}. Exiting."
  exit 1
}
trap 'handle_error ${LINENO}' ERR

# Signal handler for graceful shutdown
shutdown() {
  log INFO "Shutdown signal received. Cleaning up..."
  [[ -n "${API_PID-}" ]] && kill "$API_PID" && log INFO "Killed inference API (PID $API_PID)"
  exit 0
}
trap shutdown SIGINT SIGTERM

# Resolve directories
dirname_safe() { cd "$(dirname "$1")" >/dev/null 2>&1 && pwd; }
SCRIPT_DIR="$(dirname_safe "${BASH_SOURCE[0]}")"
ROOT="$(dirname_safe "$SCRIPT_DIR")"

# Parse command-line arguments
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      offline|continuous|both)
        MODE="$1"; shift;;
      --serve)
        SERVE=true; shift;;
      --interval)
        INTERVAL="$2"; shift 2;;
      --port)
        PORT="$2"; shift 2;;
      --log-file)
        LOG_FILE="$2"; shift 2;;
      -h|--help)
        usage;;
      *)
        log ERROR "Unknown argument: $1"; usage;;
    esac
  done
  log INFO "Configuration: MODE=$MODE, SERVE=$SERVE, INTERVAL=${INTERVAL}m, PORT=$PORT, LOG_FILE=${LOG_FILE:-none}"
}

# Start the inference API if requested
start_api() {
  if [[ "$SERVE" == true ]]; then
    log INFO "Preparing to start inference API on port $PORT"

    # If port is in use, kill all processes listening on it
    if lsof -ti tcp:"$PORT" >/dev/null; then
      local pid_list
      # Collapse newlines into spaces so we log on one line.
      pid_list=$(lsof -ti tcp:"$PORT" | xargs)
      log WARN "Port $PORT in use by PID(s) $pid_list — terminating process(es)"
      for pid in $pid_list; do
        kill -9 "$pid"
        log INFO "Terminated existing process $pid on port $PORT"
      done
    else
      log INFO "Port $PORT is free"
    fi

    # Start the ML inference API
    cd "$ROOT/ml_service"
    uvicorn ml_service:app --reload --host 0.0.0.0 --port "$PORT" &
    API_PID=$!
    log INFO "Inference API started with PID $API_PID"
    cd "$ROOT"
  fi
}

# Offline pipeline execution
offline_pipeline() {
  if [[ "$MODE" =~ ^(offline|both)$ ]]; then
    log INFO "=== RUNNING OFFLINE SELF-PLAY PIPELINE ==="
    bash "$SCRIPT_DIR/run_ml_pipeline.sh" --log-file "$LOG_FILE"
    log INFO "=== OFFLINE PIPELINE COMPLETE ==="
  fi
}

# Seed replay buffer for hybrid mode
seed_buffer() {
  if [[ "$MODE" == "both" ]]; then
    log INFO "Seeding replay buffer with offline self-play games"
    python3 "$ROOT/ml_service/scripts/ingest_and_buffer.py" \
      --live-log "$ROOT/backend/src/ml/data/raw_games.json" \
      --buffer "$ROOT/ml_service/data/replay_buffer.pkl" \
      --max-size 1000
    log INFO "Replay buffer seeding complete"
  fi
}

# Continuous learning loop
continuous_loop() {
  if [[ "$MODE" =~ ^(continuous|both)$ ]]; then
    log INFO "=== STARTING CONTINUOUS LEARNING LOOP (every $INTERVAL minutes) ==="
    while true; do
      log DEBUG "Triggering continuous pipeline cycle"
      bash "$SCRIPT_DIR/run_ml_service_pipeline.sh" --log-file "$LOG_FILE"
      log DEBUG "Sleeping for $INTERVAL minutes"
      sleep "${INTERVAL}m"
    done
  fi
}

# Main entrypoint
main() {
  parse_args "$@"
  start_api
  offline_pipeline
  seed_buffer
  continuous_loop
  log INFO "=== PIPELINE SETUP COMPLETE ==="
}

# Execute

main "$@"
