#!/usr/bin/env bash
set -euo pipefail

# ----------------------------------------------------------------------------
# scripts/run_ml_pipeline.sh
# Advanced Offline ML Pipeline:
#   1) Generate raw self-play data
#   2) Preprocess data
#   3) Sanity check output files
#   4) Train policy neural network
#   5) Optionally serve inference API for logging
# ----------------------------------------------------------------------------

# ANSI color codes for leveled logs
RED="\033[1;31m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
BLUE="\033[1;34m"
RESET="\033[0m"

#-----------------------------------------------------------------------------#
# Function: echo_log
# Purpose : Print timestamped, colored log messages with levels
# Usage   : echo_log <LEVEL> <message>
# Levels  : INFO, WARN, ERROR, DEBUG
#-----------------------------------------------------------------------------#
echo_log() {
  local level="$1"; shift
  local ts="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  local color
  case "$level" in
    INFO)  color="$GREEN";;
    WARN)  color="$YELLOW";;
    ERROR) color="$RED";;
    DEBUG) color="$BLUE";;
    *)     color="$RESET";;
  esac
  printf "%b[%s] [%s] %s%b\n" "$color" "$ts" "$level" "$*" "$RESET"
}

#-----------------------------------------------------------------------------#
# Function: handle_error
# Purpose : Catch any uncaught errors and log line number
# Trigger : ERR trap
#-----------------------------------------------------------------------------#
handle_error() {
  local lineno="$1"
  echo_log ERROR "Error at line $lineno. Pipeline aborted."
  exit 1
}
trap 'handle_error ${LINENO}' ERR

#-----------------------------------------------------------------------------#
# Function: cleanup
# Purpose : Handle interrupt signals for graceful termination
# Trigger : SIGINT, SIGTERM traps
#-----------------------------------------------------------------------------#
cleanup() {
  echo_log INFO "Shutdown signal received. Exiting offline pipeline..."
  exit 0
}
trap cleanup SIGINT SIGTERM

#-----------------------------------------------------------------------------#
# Resolve script path and project root
#-----------------------------------------------------------------------------#
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT"

echo_log INFO "=== STARTING OFFLINE PIPELINE ==="

#-----------------------------------------------------------------------------#
# Function: generate_data
# Purpose : Run TypeScript script to produce raw self-play games
#-----------------------------------------------------------------------------#
generate_data() {
  echo_log INFO "Step 1: Generating raw self-play games"
  npx ts-node backend/src/ml/scripts/generate_game_data.ts || {
    echo_log ERROR "Data generation failed"
    return 1
  }
  echo_log INFO "Data generation complete"
}

#-----------------------------------------------------------------------------#
# Function: preprocess_data
# Purpose : Convert raw games into train/test splits and features
#-----------------------------------------------------------------------------#
preprocess_data() {
  echo_log INFO "Step 2: Preprocessing data"
  python3 backend/src/ml/scripts/preprocess.py || {
    echo_log ERROR "Preprocessing failed"
    return 1
  }
  echo_log INFO "Preprocessing complete"
}

#-----------------------------------------------------------------------------#
# Function: sanity_check
# Purpose : Verify that expected data files exist and have reasonable sizes
#-----------------------------------------------------------------------------#
sanity_check() {
  echo_log INFO "Step 3: Verifying data files"
  local files=(
    "backend/src/ml/data/raw_games.json"
    "backend/src/ml/data/train.json"
    "backend/src/ml/data/test.json"
  )
  for f in "${files[@]}"; do
    if [[ -s "$f" ]]; then
      echo_log DEBUG "Found file: $f ($(du -h "$f" | cut -f1))"
    else
      echo_log WARN "Missing or empty file: $f"
    fi
  done
  echo_log INFO "Sanity check complete"
}

#-----------------------------------------------------------------------------#
# Function: train_policy_net
# Purpose : Train the policy network using prepared datasets
#-----------------------------------------------------------------------------#
train_policy_net() {
  echo_log INFO "Step 4: Training policy network"
  python3 backend/src/ml/scripts/train_policy.py \
    --train-json backend/src/ml/data/train.json \
    --test-data  backend/src/ml/data/test.json \
    --epochs     50 \
    --batch-size 128 || {
      echo_log ERROR "Training policy network failed"
      return 1
    }
  echo_log INFO "Policy network training complete"
}

#-----------------------------------------------------------------------------#
# Function: serve_inference
# Purpose : Optionally serve the inference API for human vs AI logging
#-----------------------------------------------------------------------------#
#-----------------------------------------------------------------------------#
# Start it manually
# =================
# If you'd rather bring it up by hand, in one terminal:
#
#  cd /ConnectFourGame/ml_service
#     uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000
#
# Then, in another terminal, your same curl command will connect:
#
#   curl -v http://localhost:8000/predict \
#      -H 'Content-Type: application/json' \
#      -d '{"board": [[…]], "aiDisc": "Red"}'
#
#-----------------------------------------------------------------------------#
serve_inference() {
  echo_log INFO "Step 5: Starting inference server"
  cd ml_service
  uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000 || {
    echo_log ERROR "Failed to start inference server"
    return 1
  }
}

# Execute pipeline steps
generate_data
preprocess_data
sanity_check
train_policy_net
serve_inference

echo_log INFO "=== OFFLINE PIPELINE COMPLETE ==="
